import type { AppRole } from '@/contexts/AuthContext';

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  vendedor: 'Vendedor',
  time_operacional: 'Time Operacional',
};
