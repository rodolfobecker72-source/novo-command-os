# Roadmap

- [x] Permitir reordenar condições de pagamento e refletir a sequência na seleção das propostas (testes aprovados; conta atual sem acesso à tela de reordenação)
- [x] Trocar setas por controle de clicar e arrastar nas condições, igual à lista de propostas (três testes aprovados)

- [x] Diagnóstico do filtro de mês na Gestão de Leads (versão publicada com offset de mês; código atual correto)
- [x] Ícones de WhatsApp e e-mail nos cards de leads (ativos quando cadastrado, cinza quando não; clique abre o app)
- [x] Cadastro de empresa direto em /clientes, sem passar pela Gestão de Leads
- [x] Central de Mídias: projetos em ordem alfabética crescente dentro de cada HD
- [ ] Publicar o app com o filtro corrigido + ícones — aguardando o usuário clicar em Publicar (deploy recusado no chat; correções só entram no ar no próximo publish)
- [x] Remover "Termos e Condições" do Layout da Proposta e do PDF gerado (pedido 20/10/2026 22:11)

- [x] Auditoria de acessos e bugs (28/10/2026): redefinição de senha restrita ao dono do próprio workspace, políticas de leads/feedback/logos/avatares isoladas por empresa, cadastro sem tela em branco, PageGuard sem redirecionar para página bloqueada, erros de exclusão no Financeiro visíveis
- [x] Aplicar a migration `20261028020000_security_hardening.sql` no banco e publicar as edge functions (reset-user-password)
- [x] Permissões por papel no banco: Financeiro/Patrimônio só Dono e Admin; Configurações leitura para todos e edição só do Dono; custo pago no orçamento só Dono/Admin (migration `20261028030000_role_based_rls.sql`)
