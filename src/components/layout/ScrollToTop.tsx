import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Rotas que gerenciam a própria posição de rolagem (restauração ao voltar)
const SELF_MANAGED = ['/gestao-projetos'];

export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    if (SELF_MANAGED.some((p) => pathname.startsWith(p))) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, navigationType]);

  return null;
}
