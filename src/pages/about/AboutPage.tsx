import commandLogo from '@/assets/command-logo.png';
import { Header } from '@/components/layout/Header';

export function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header title="Sobre" subtitle="Sobre o Command OS" />
      <div className="flex items-center justify-center p-8">
      <div className="max-w-xl text-center space-y-8">
        <img src={commandLogo} alt="Command OS" className="h-20 w-auto mx-auto dark:brightness-0 dark:invert" />

        <div className="space-y-5 text-muted-foreground leading-relaxed">
          <p>
            O Command OS é desenvolvido para produtoras audiovisuais que querem organizar e profissionalizar sua gestão comercial.
          </p>
          <p>
            Com módulos de Prospecção, Clientes e Pipeline de Propostas, o sistema permite acompanhar oportunidades desde o primeiro contato até a aprovação do projeto, garantindo mais controle, visibilidade e previsibilidade nas vendas.
          </p>
          <p>
            Simples, estruturado e pensado para a realidade das produtoras, o Command OS transforma o comercial em processo — e processo em crescimento.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
