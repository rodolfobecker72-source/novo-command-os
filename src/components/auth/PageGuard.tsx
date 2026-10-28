import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { APP_PAGES } from '@/config/pages';
import { Button } from '@/components/ui/button';

interface PageGuardProps {
  pageKey: string;
  children: React.ReactNode;
}

export function PageGuard({ pageKey, children }: PageGuardProps) {
  const { hasPageAccess, isLoading, membership, logout } = useAuth();
  const navigate = useNavigate();
  const allowed = isLoading ? true : hasPageAccess(pageKey);
  // Redirect to the first page the user can open. Always targeting
  // /boas-vindas left users without that permission on a blank screen.
  const fallback = allowed ? null : APP_PAGES.find((p) => p.key !== pageKey && hasPageAccess(p.key));

  useEffect(() => {
    if (!isLoading && !allowed && fallback) {
      toast.error('Você não tem permissão para acessar esta página.');
    }
  }, [isLoading, allowed, fallback]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!allowed && fallback) {
    return <Navigate to={fallback.href} replace />;
  }

  if (!allowed) {
    const handleLogout = async () => {
      await logout();
      navigate('/login');
    };
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">
            {membership ? 'Nenhuma página liberada' : 'Conta sem empresa vinculada'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {membership
              ? 'Seu usuário ainda não tem acesso a nenhuma página do sistema. Peça ao responsável pela conta para liberar suas permissões.'
              : 'Não encontramos uma empresa vinculada ao seu usuário. Peça ao responsável pela conta para adicionar você ou tente entrar novamente.'}
          </p>
          <Button variant="outline" onClick={handleLogout}>Sair</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
