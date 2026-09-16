import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { getAllPageKeys, isRoleRestricted } from '@/config/pages';

export type AppRole = 'owner' | 'admin' | 'vendedor' | 'visualizador' | 'time_hero';

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
  signup: (email: string, password: string, name: string, workspaceName: string) => Promise<{ error: string | null }>;
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

  const loadUserData = async (userId: string, retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Load profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (profileError) {
          console.error(`[Auth] Attempt ${attempt}: Failed to load profile:`, profileError.message);
          if (attempt < retries) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
        }
        setProfile(profileData as Profile | null);

        // Load workspace membership
        const { data: memberData, error: memberError } = await supabase
          .from('workspace_members')
          .select('*')
          .eq('user_id', userId)
          .limit(1)
          .single();

        if (memberError) {
          console.error(`[Auth] Attempt ${attempt}: Failed to load workspace_members:`, memberError.message);
          if (attempt < retries) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
        }

        if (memberData) {
          setMembership(memberData as unknown as WorkspaceMember);

          // Load workspace
          const { data: wsData, error: wsError } = await supabase
            .from('workspaces')
            .select('*')
            .eq('id', (memberData as any).workspace_id)
            .single();

          if (wsError) {
            console.error(`[Auth] Attempt ${attempt}: Failed to load workspace:`, wsError.message);
            if (attempt < retries) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
          }

          setWorkspace(wsData as Workspace | null);
        } else {
          setMembership(null);
          setWorkspace(null);
          console.warn('[Auth] No workspace membership found for user:', userId);
        }
        // Success — break the retry loop
        return;
      } catch (error) {
        console.error(`[Auth] Attempt ${attempt}: Unexpected error loading user data:`, error);
        if (attempt < retries) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
      }
    }
    console.error('[Auth] All retry attempts exhausted for loadUserData');
  };

  // Track whether user data has been loaded at least once to prevent duplicate SIGNED_IN reloads
  const hasLoadedRef = useRef(false);
  const loadingUserDataRef = useRef(false);

  useEffect(() => {
    let initialLoad = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Skip if this is the initial event (handled by getSession below)
        if (initialLoad) return;

        if (event === 'SIGNED_IN') {
          // If user data is already loaded, do NOT set isLoading=true again
          // This prevents the spinner flash on duplicate SIGNED_IN events (tab focus, session restore)
          if (hasLoadedRef.current) {
            return;
          }
          // Prevent concurrent loads
          if (loadingUserDataRef.current) {
            return;
          }
          loadingUserDataRef.current = true;
          setIsLoading(true);
          try {
            await loadUserData(newSession!.user.id);
            hasLoadedRef.current = true;
          } finally {
            loadingUserDataRef.current = false;
            setIsLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          hasLoadedRef.current = false;
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
        loadingUserDataRef.current = true;
        try {
          await loadUserData(initialSession.user.id);
          hasLoadedRef.current = true;
        } finally {
          loadingUserDataRef.current = false;
        }
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
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
  ): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) return { error: error.message };

    // If user was auto-confirmed (or email confirm disabled), create workspace
    if (data.user && data.session) {
      const { error: wsError } = await supabase.rpc('handle_signup_workspace', {
        workspace_name: workspaceName,
      });
      if (wsError) return { error: wsError.message };
    }

    return { error: null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setWorkspace(null);
    setMembership(null);
  };

  const hasPageAccess = (pageKey: string): boolean => {
    if (!membership) return false;
    // Check role-based restrictions first (e.g. vendedor cannot access Configurações pages)
    if (role && isRoleRestricted(pageKey, role)) return false;
    // Owner and admin have access to everything
    if (role === 'owner' || role === 'admin') return true;
    // If no specific permissions set, grant all access
    if (!membership.page_permissions || membership.page_permissions.length === 0) return true;
    return membership.page_permissions.includes(pageKey);
  };

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
