import { Loader2, LogOut } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import commandLogo from '@/assets/command-logo.png';
import { AdminDashboard } from './AdminDashboard';
import { AdminLogin } from './AdminLogin';
import { useAdminAccess } from './useAdminAccess';

/**
 * Standalone app served on admin.command-os.app.br: its own login with
 * mandatory 2-step verification and no link to any company workspace.
 */
export default function AdminApp() {
  const { access, recheck } = useAdminAccess();

  let content;
  if (access.state === 'loading') {
    content = (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  } else if (access.state !== 'ready') {
    content = <AdminLogin access={access} onChange={recheck} />;
  } else {
    content = (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img src={commandLogo} alt="Command OS" className="h-7 w-auto dark:brightness-0 dark:invert" />
              <span className="text-sm font-semibold text-muted-foreground truncate">Administração</span>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <span className="hidden sm:inline text-xs text-muted-foreground truncate">{access.session.user.email}</span>
              <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
                <LogOut className="w-4 h-4 mr-1" />
                Sair
              </Button>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">
          <AdminDashboard />
        </main>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Toaster />
      {content}
    </TooltipProvider>
  );
}
