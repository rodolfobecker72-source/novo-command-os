// Registro central de tutoriais por página.
// Basta preencher `videoUrl` (link de embed do YouTube/Vimeo/Loom) para publicar o vídeo.

export interface PageTutorial {
  path: string;        // prefixo da rota
  title: string;       // título do tutorial
  description: string; // resumo do que o usuário aprende
  videoUrl?: string;   // URL de embed (opcional enquanto não houver vídeo)
}

export const PAGE_TUTORIALS: PageTutorial[] = [
  { path: '/boas-vindas', title: 'Tela de Boas-vindas', description: 'Entenda os avisos, tarefas e atalhos da tela inicial.' },
  { path: '/meu-calendario', title: 'Meu Calendário', description: 'Veja suas atividades, captações e entregas por dia, semana ou mês.' },
  { path: '/prospeccao', title: 'Gestão de Leads', description: 'Como cadastrar leads, mover no funil, confirmar reuniões e migrar para o CRM.' },
  { path: '/clientes', title: 'Empresas Cadastradas', description: 'Consulte, edite e acompanhe o score das empresas cadastradas.' },
  { path: '/crm', title: 'CRM', description: 'Fluxo completo do orçamento: criação, versões, aprovação e execução.' },
  { path: '/gestao-projetos', title: 'Área de Projetos', description: 'Acompanhe atividades, responsáveis e progresso de cada projeto.' },
  { path: '/calendario-time', title: 'Calendário do Time', description: 'Visualize as atividades de vários membros com cores e legendas.' },
  
  { path: '/central-midia', title: 'Central de Mídias', description: 'Organize arquivos, HDs e mídias dos projetos.' },
  { path: '/projetos/historico', title: 'Histórico de Projetos', description: 'Consulte projetos anteriores agrupados por período.' },
  { path: '/categorias', title: 'Categorias de Serviço', description: 'Crie, edite e reordene as categorias usadas nos orçamentos.' },
  { path: '/itens-servico', title: 'Itens de Serviço', description: 'Gerencie o catálogo de itens e sua ordenação.' },
  { path: '/configuracoes/regras-comerciais', title: 'Regras Comerciais', description: 'Defina margens, impostos e condições de pagamento padrão.' },
  { path: '/configuracoes/layout', title: 'Layout da Proposta', description: 'Personalize logos, textos e seções das propostas em PDF.' },
  { path: '/configuracoes/contrato', title: 'Minuta de Contrato', description: 'Configure a minuta e os campos dinâmicos do contrato.' },
  { path: '/configuracoes/metas', title: 'Metas', description: 'Defina metas de faturamento e de reuniões por mês.' },
  { path: '/financeiro', title: 'Financeiro', description: 'Fluxo de caixa, contas, cartões e acompanhamento de projetos.' },
  { path: '/patrimonio', title: 'Patrimônio', description: 'Controle dos equipamentos e bens da operação.' },
  { path: '/usuarios', title: 'Usuários', description: 'Cadastro de membros, permissões e redefinição de senha.' },
  { path: '/meu-financeiro', title: 'Meu Financeiro', description: 'Acompanhe seus lançamentos e recebimentos.' },
];

export function getTutorialForPath(pathname: string): PageTutorial | undefined {
  const matches = PAGE_TUTORIALS.filter(
    (t) => pathname === t.path || pathname.startsWith(`${t.path}/`)
  );
  if (matches.length === 0) return undefined;
  // rota mais específica vence
  return matches.sort((a, b) => b.path.length - a.path.length)[0];
}
