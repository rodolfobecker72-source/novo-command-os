import { Link } from 'react-router-dom';
import { CONTACT_EMAIL, LegalLayout } from './LegalLayout';

export default function TermsOfUse() {
  return (
    <LegalLayout title="Termos de Uso">
      <section>
        <p>
          Estes termos regem o uso do Command OS, plataforma de gestão comercial e operacional para empresas
          de audiovisual. Ao criar uma conta ou usar o sistema, você concorda com eles.
        </p>
      </section>

      <section>
        <h2>1. Conta</h2>
        <ul>
          <li>Você é responsável por manter sua senha em sigilo e pelas ações feitas com sua conta.</li>
          <li>O dono da conta da empresa define quem da equipe tem acesso e com qual perfil.</li>
        </ul>
      </section>

      <section>
        <h2>2. Uso permitido</h2>
        <p>
          O sistema deve ser usado para a gestão do próprio negócio, de forma lícita. Não é permitido tentar
          acessar dados de outras empresas, contornar as permissões de acesso ou prejudicar o funcionamento do
          serviço.
        </p>
      </section>

      <section>
        <h2>3. Seus dados</h2>
        <p>
          Os dados cadastrados pertencem à sua empresa. O tratamento de dados pessoais segue a{' '}
          <Link to="/privacidade">Política de Privacidade</Link>.
        </p>
      </section>

      <section>
        <h2>4. Integrações</h2>
        <p>
          Integrações com serviços de terceiros, como o Google Agenda, são opcionais e também seguem os termos
          desses serviços. Você pode desconectá-las a qualquer momento.
        </p>
      </section>

      <section>
        <h2>5. Disponibilidade</h2>
        <p>
          Trabalhamos para manter o serviço disponível e seguro, mas podem ocorrer interrupções para manutenção
          ou por falhas de fornecedores. Recomendamos guardar cópias dos documentos importantes, como propostas
          e contratos em PDF.
        </p>
      </section>

      <section>
        <h2>6. Alterações e contato</h2>
        <p>
          Estes termos podem ser atualizados; a data no topo indica a versão em vigor. Dúvidas:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </LegalLayout>
  );
}
