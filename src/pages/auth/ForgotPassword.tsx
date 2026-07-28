import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import commandLogo from '@/assets/command-logo.png';
import { ArrowLeft } from 'lucide-react';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success('Email de recuperação enviado!');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-sidebar-background flex flex-col items-center justify-center p-4 gap-8">
      <img src={commandLogo} alt="Command CRM" className="h-14 w-auto dark:brightness-0 dark:invert" />

      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center space-y-1.5 pb-2">
          <CardTitle className="text-2xl text-foreground">Recuperar senha</CardTitle>
          <CardDescription className="text-muted-foreground leading-relaxed">
            {sent
              ? 'Verifique sua caixa de entrada e clique no link para redefinir sua senha.'
              : 'Informe seu email para receber um link de recuperação.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Digite seu email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Enviando...' : 'Enviar link de recuperação'}
              </Button>
              <Link
                to="/login"
                className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground pt-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao login
              </Link>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Não recebeu? Verifique a pasta de spam ou tente novamente.
              </p>
              <Button variant="outline" onClick={() => setSent(false)} className="w-full">
                Tentar novamente
              </Button>
              <Link
                to="/login"
                className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao login
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
