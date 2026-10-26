// Centralized registry of all pages in the system
// When adding new pages, add them here and they'll appear in user permissions

export interface AppPage {
  key: string;      // Unique key for permission storage
  label: string;    // Display name
  href: string;     // Route path
  group: string;    // Navigation group name
  restrictedFrom?: string[]; // Roles that should NEVER access this page
}

export const APP_PAGES: AppPage[] = [
  // Início
  { key: 'boas-vindas', label: 'Boas-vindas', href: '/boas-vindas', group: 'Início' },
  { key: 'meu-calendario', label: 'Meu Calendário', href: '/meu-calendario', group: 'Início' },

  // Comercial
  { key: 'prospeccao', label: 'Gestão de Leads', href: '/prospeccao', group: 'Comercial', restrictedFrom: ['time_hero'] },
  { key: 'clientes', label: 'Clientes', href: '/clientes', group: 'Comercial', restrictedFrom: ['time_hero'] },
  { key: 'crm', label: 'CRM', href: '/crm', group: 'Comercial', restrictedFrom: ['time_hero'] },

  // Operação / Projetos
  { key: 'gestao-projetos', label: 'Área de Projetos', href: '/gestao-projetos', group: 'Projetos' },
  
  { key: 'calendario-time', label: 'Calendário do Time', href: '/calendario-time', group: 'Projetos', restrictedFrom: ['vendedor', 'visualizador', 'time_hero'] },
  { key: 'central-midia', label: 'Central de Mídias', href: '/central-midia', group: 'Projetos' },
  { key: 'historico-projetos', label: 'Histórico', href: '/projetos/historico', group: 'Projetos' },

  // Configurações
  { key: 'categorias', label: 'Categorias de Serviço', href: '/categorias', group: 'Configurações', restrictedFrom: ['admin', 'vendedor', 'visualizador', 'time_hero'] },
  { key: 'itens-servico', label: 'Itens de Serviço', href: '/itens-servico', group: 'Configurações', restrictedFrom: ['admin', 'vendedor', 'visualizador', 'time_hero'] },
  { key: 'regras-comerciais', label: 'Regras Comerciais', href: '/configuracoes/regras-comerciais', group: 'Configurações', restrictedFrom: ['admin', 'vendedor', 'visualizador', 'time_hero'] },
  { key: 'layout', label: 'Layout da Proposta', href: '/configuracoes/layout', group: 'Configurações', restrictedFrom: ['vendedor', 'admin', 'visualizador', 'time_hero'] },
  { key: 'contrato', label: 'Minuta de Contrato', href: '/configuracoes/contrato', group: 'Configurações', restrictedFrom: ['vendedor', 'admin', 'visualizador', 'time_hero'] },
  { key: 'metas', label: 'Metas', href: '/configuracoes/metas', group: 'Configurações', restrictedFrom: ['vendedor', 'admin', 'visualizador', 'time_hero'] },
  
  // Administrativo
  { key: 'dashboard', label: 'Dashboard', href: '/crm/dashboard', group: 'Administrativo', restrictedFrom: ['vendedor', 'visualizador', 'time_hero'] },
  { key: 'financeiro', label: 'Financeiro', href: '/financeiro', group: 'Administrativo', restrictedFrom: ['vendedor', 'visualizador', 'time_hero'] },
  { key: 'patrimonio', label: 'Patrimônio', href: '/patrimonio', group: 'Administrativo', restrictedFrom: ['vendedor', 'visualizador', 'time_hero'] },
  { key: 'financeiro-time', label: 'Financeiro do Time', href: '/financeiro-time', group: 'Administrativo', restrictedFrom: ['vendedor', 'visualizador', 'time_hero'] },
  { key: 'meu-financeiro', label: 'Meu Financeiro', href: '/meu-financeiro', group: 'Administrativo' },

  // Sistema
  { key: 'usuarios', label: 'Usuários', href: '/usuarios', group: 'Sistema', restrictedFrom: ['admin', 'vendedor', 'visualizador', 'time_hero'] },
];

// Get all page keys (useful for setting "all access" by default)
export function getAllPageKeys(): string[] {
  return APP_PAGES.map(p => p.key);
}

// Check if a role is restricted from a page
export function isRoleRestricted(pageKey: string, role: string): boolean {
  const page = APP_PAGES.find(p => p.key === pageKey);
  return page?.restrictedFrom?.includes(role) ?? false;
}

// Group pages by their group name for display
export function getPagesByGroup(): Record<string, AppPage[]> {
  return APP_PAGES.reduce((acc, page) => {
    if (!acc[page.group]) acc[page.group] = [];
    acc[page.group].push(page);
    return acc;
  }, {} as Record<string, AppPage[]>);
}
