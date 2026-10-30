import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { canAccessPage } from '@/config/pages';

export type AppRole = 'owner' | 'admin' | 'vendedor' | 'time_operacional';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: AppRole;
  page_permissions: string[];
  joined_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string;
  photo_url: string | null;
  birth_date: string | null;
  created_at: string;
}

interface AuthContextType {
  session: Session | null;
  user: SupabaseUser | null;
  profile: Profile | null;
  workspace: Workspace | null;
  membership: WorkspaceMember | null;
  role: AppRole | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, name: string, workspaceName: string) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>;
  logout: () => Promise<void>;
  hasPageAccess: (pageKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [membership, setMembership] = useState<WorkspaceMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const role = membership?.role as AppRole | null;

  // Only the most recent load may write state, so a slow earlier load can't
  // overwrite fresher data (e.g. SIGNED_IN racing the workspace creation).
  const loadSeqRef = useRef(0);
  const loadPromiseRef = useRef<{ userId: string; promise: Promise<void> } | null>(null);

  const loadUserData = async (authUser: SupabaseUser, retries = 3) => {
    const userId = authUser.id;
    const seq = ++loadSeqRef.current;
    const isCurrent = () => seq === loadSeqRef.current;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Load profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        
        if (profileError) {
          console.error(`[Auth] Attempt ${attempt}: Failed to load profile:`, profileError.message);
          if (attempt < retries) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
        }

        // Load workspace membership
        const fetchMembership = () => supabase
          .from('workspace_members')
          .select('*')
          .eq('user_id', userId)
          .order('joined_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        let { data: memberData, error: memberError } = await fetchMembership();

        if (memberError) {
          console.error(`[Auth] Attempt ${attempt}: Failed to load workspace_members:`, memberError.message);
          if (attempt < retries) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
        }

        // Self-signup whose workspace wasn't created yet (email confirmation
        // flow, or the signup request was interrupted): create it now.
        const pendingWorkspaceName = (authUser.user_metadata?.workspace_name as string | undefined)?.trim();
        if (!memberData && !memberError && pendingWorkspaceName) {
          const { error: wsCreateError } = await supabase.rpc('handle_signup_workspace', {
            workspace_name: pendingWorkspaceName,
          });
          if (wsCreateError) {
            console.error('[Auth] Failed to create workspace for new signup:', wsCreateError.message);
          }
          ({ data: memberData, error: memberError } = await fetchMembership());
        }

        let wsData: Workspace | null = null;
        if (memberData) {
          // Load workspace
          const { data, error: wsError } = await supabase
            .from('workspaces')
            .select('*')
            .eq('id', (memberData as any).workspace_id)
            .single();

          if (wsError) {
            console.error(`[Auth] Attempt ${attempt}: Failed to load workspace:`, wsError.message);
            if (attempt < retries) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
          }
          wsData = data as Workspace | null;
        } else {
          console.warn('[Auth] No workspace membership found for user:', userId);
        }

        if (!isCurrent()) return;
        setProfile(profileData as Profile | null);
        setMembership((memberData as unknown as WorkspaceMember) ?? null);
        setWorkspace(wsData);
        // Success — break the retry loop
        return;
      } catch (error) {
        console.error(`[Auth] Attempt ${attempt}: Unexpected error loading user data:`, error);
        if (attempt < retries) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
      }
    }
    console.error('[Auth] All retry attempts exhausted for loadUserData');
  };

  // Single-flight: concurrent callers (SIGNED_IN event, signup) share one load.
  const ensureUserData = (authUser: SupabaseUser): Promise<void> => {
    const current = loadPromiseRef.current;
    if (current && current.userId === authUser.id) return current.promise;
    const promise = loadUserData(authUser);
    loadPromiseRef.current = { userId: authUser.id, promise };
    return promise;
  };

  useEffect(() => {
    let initialLoad = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Skip if this is the initial event (handled by getSession below)
        if (initialLoad) return;

        if (event === 'SIGNED_IN' && newSession?.user) {
          // If user data is already loaded (or loading), do NOT set isLoading=true again.
          // This prevents the spinner flash on duplicate SIGNED_IN events (tab focus, session restore)
          if (loadPromiseRef.current?.userId === newSession.user.id) return;
          setIsLoading(true);
          // Defer Supabase calls out of the auth callback: awaiting them here can
          // deadlock the auth client's internal lock.
          const authUser = newSession.user;
          setTimeout(() => {
            ensureUserData(authUser).finally(() => setIsLoading(false));
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          loadPromiseRef.current = null;
          loadSeqRef.current++;
          setProfile(null);
          setWorkspace(null);
          setMembership(null);
          setIsLoading(false);
        }
        // TOKEN_REFRESHED, USER_UPDATED — session/user updated above, no loading toggle
      }
    );

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      initialLoad = false;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        await ensureUserData(initialSession.user);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    workspaceName: string
  ): Promise<{ error: string | null; needsEmailConfirmation?: boolean }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // workspace_name is consumed by loadUserData, which creates the
        // workspace on the first session (now, or after email confirmation).
        data: { name, workspace_name: workspaceName },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) return { error: error.message };

    if (!data.session || !data.user) {
      return { error: null, needsEmailConfirmation: true };
    }

    setIsLoading(true);
    try {
      await ensureUserData(data.user);
    } finally {
      setIsLoading(false);
    }
    return { error: null };
  };

  const logout = async () => {
    // 'local' ends only this browser's session (other devices stay signed in).
    // Don't let a slow request keep the user on a signed-in screen.
    const { error } = await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      new Promise<{ error: Error }>((resolve) =>
        setTimeout(() => resolve({ error: new Error('signOut timeout') }), 4000),
      ),
    ]);
    if (error) {
      console.warn('[Auth] signOut did not finish, clearing the stored session:', error.message);
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
        .forEach((k) => localStorage.removeItem(k));
    }
    loadPromiseRef.current = null;
    setSession(null);
    setUser(null);
    setProfile(null);
    setWorkspace(null);
    setMembership(null);
    // Full page load on the login screen: no screen or data of the previous
    // user stays in memory.
    window.location.replace('/login');
  };

  const hasPageAccess = (pageKey: string): boolean => canAccessPage(pageKey, membership);

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user,
      profile,
      workspace,
      membership,
      role,
      isLoading,
      login,
      signup,
      logout,
      hasPageAccess,
    }),
    // login/signup/logout/hasPageAccess dependem apenas de membership/role
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, user, profile, workspace, membership, role, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
