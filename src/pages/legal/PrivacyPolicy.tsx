import { CONTACT_EMAIL, LegalLayout } from './LegalLayout';

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Política de Privacidade">
      <section>
        <p>
          O Command OS é uma plataforma de gestão comercial e operacional para empresas de audiovisual:
          prospecção, clientes, CRM, propostas, projetos, agenda e financeiro. Esta política explica quais
          dados tratamos, para quê e quais são os seus direitos, de acordo com a Lei Geral de Proteção de
          Dados (Lei 13.709/2018).
        </p>
        <p>Contato sobre privacidade: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </section>

      <section>
        <h2>1. Dados que tratamos</h2>
        <ul>
          <li><strong>Conta de usuário:</strong> nome, e-mail, foto de perfil e senha (guardada apenas de forma cifrada pelo provedor de autenticação).</li>
          <li><strong>Dados inseridos pela empresa:</strong> clientes, contatos, leads, orçamentos, projetos, atividades, compromissos, metas e lançamentos financeiros cadastrados pela empresa e sua equipe.</li>
          <li><strong>Dados técnicos:</strong> registros de acesso e de erros necessários para manter o serviço seguro e funcionando.</li>
          <li><strong>Google Agenda (opcional):</strong> descrito em detalhe na seção 3.</li>
        </ul>
        <p>
          Em relação aos dados que a empresa cadastra sobre os próprios clientes e contatos, a empresa é a
          controladora e o Command OS atua como operador, tratando esses dados somente para prestar o serviço.
        </p>
      </section>

      <section>
        <h2>2. Para que usamos</h2>
        <ul>
          <li>Permitir o acesso à conta e o uso das funcionalidades contratadas.</li>
          <li>Enviar e-mails do próprio serviço, como convites e redefinição de senha.</li>
          <li>Manter a segurança, prevenir abusos e corrigir falhas.</li>
        </ul>
        <p>Não vendemos dados pessoais e não os usamos para publicidade.</p>
      </section>

      <section>
        <h2>3. Integração com o Google Agenda</h2>
        <p>
          A integração é opcional e cada usuário decide se conecta a própria conta Google, no seu perfil
          dentro do Command OS.
        </p>
        <ul>
          <li>
            <strong>O que acessamos:</strong> o endereço de e-mail da conta Google conectada e a permissão
            para criar uma agenda chamada "Command OS" e gerenciar os eventos <em>somente dessa agenda</em>
            (escopo <code>calendar.app.created</code>). Não temos acesso às suas outras agendas nem aos seus
            outros eventos.
          </li>
          <li>
            <strong>Como usamos:</strong> criar, atualizar e remover, nessa agenda, eventos das atividades de
            projeto e dos compromissos em que você é responsável ou participante no Command OS. O e-mail é
            exibido no seu perfil para indicar qual conta está conectada.
          </li>
          <li>
            <strong>Armazenamento:</strong> os tokens de acesso fornecidos pelo Google são guardados
            criptografados e só são usados pelos servidores do Command OS para essa sincronização.
          </li>
          <li>
            <strong>Compartilhamento:</strong> os dados recebidos do Google não são vendidos, não são
            compartilhados com terceiros, não são usados para publicidade e não são usados para treinar
            modelos de inteligência artificial. Nenhuma pessoa lê esses dados, exceto quando você pedir
            suporte e autorizar, quando for necessário por segurança ou quando a lei exigir.
          </li>
          <li>
            <strong>Como desconectar:</strong> use "Desconectar" no seu perfil. Ao desconectar, removemos a
            agenda "Command OS" da sua conta Google, revogamos o acesso e apagamos os tokens guardados. Você
            também pode revogar o acesso a qualquer momento em{' '}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>.
          </li>
        </ul>
        <p>
          O uso e a transferência, para qualquer outro aplicativo, de informações recebidas das APIs do Google
          seguem a{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Política de Dados do Usuário dos Serviços de API do Google
          </a>
          , incluindo os requisitos de Uso Limitado.
        </p>
      </section>

      <section>
        <h2>4. Onde os dados ficam</h2>
        <p>
          Usamos fornecedores de infraestrutura que tratam os dados apenas para prestar o serviço: Supabase
          (banco de dados, autenticação e arquivos, com servidores em São Paulo), Vercel (hospedagem do site)
          e Resend (envio de e-mails do sistema). A comunicação é sempre criptografada (HTTPS).
        </p>
      </section>

      <section>
        <h2>5. Por quanto tempo</h2>
        <p>
          Mantemos os dados enquanto a conta da empresa estiver ativa. Dados de um usuário removido da empresa
          deixam de ser acessíveis a ele; a pedido, excluímos a conta e os dados pessoais associados, exceto o
          que a lei obrigar a guardar.
        </p>
      </section>

      <section>
        <h2>6. Seus direitos</h2>
        <p>
          Você pode pedir confirmação de tratamento, acesso, correção, portabilidade e exclusão dos seus dados,
          além de informações sobre compartilhamento, pelo e-mail{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Se os dados foram cadastrados por uma
          empresa cliente do Command OS, o pedido também pode ser feito diretamente a ela.
        </p>
      </section>

      <section>
        <h2>7. Alterações</h2>
        <p>
          Podemos atualizar esta política. A data no topo indica a versão em vigor; mudanças relevantes são
          comunicadas no próprio sistema ou por e-mail.
        </p>
      </section>
    </LegalLayout>
  );
}
