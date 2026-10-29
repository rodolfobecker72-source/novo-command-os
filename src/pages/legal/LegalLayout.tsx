import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export const CONTACT_EMAIL = 'rodolfobecker72@gmail.com';
export const LAST_UPDATED = '29 de outubro de 2026';

// Public pages (no login): privacy policy and terms of use
export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <Link to="/login" className="text-sm text-primary hover:underline">← Command OS</Link>
        <h1 className="mt-6 text-2xl sm:text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: {LAST_UPDATED}</p>
        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p+p]:mt-3 [&_ul+p]:mt-3 [&_p+ul]:mt-3 [&_a]:text-primary [&_a]:underline">
          {children}
        </div>
        <footer className="mt-12 pt-6 border-t border-border text-sm text-muted-foreground flex flex-wrap gap-4">
          <Link to="/privacidade" className="hover:underline">Política de Privacidade</Link>
          <Link to="/termos" className="hover:underline">Termos de Uso</Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline">{CONTACT_EMAIL}</a>
        </footer>
      </div>
    </div>
  );
}
