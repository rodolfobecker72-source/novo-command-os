import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface PageGuardProps {
  pageKey: string;
  children: React.ReactNode;
}

export function PageGuard({ pageKey, children }: PageGuardProps) {
  const { hasPageAccess, isLoading } = useAuth();
  const allowed = isLoading ? true : hasPageAccess(pageKey);

  useEffect(() => {
    if (!isLoading && !allowed) {
      toast.error('Você não tem permissão para acessar esta página.');
    }
  }, [isLoading, allowed]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/boas-vindas" replace />;
  }

  return <>{children}</>;
}
