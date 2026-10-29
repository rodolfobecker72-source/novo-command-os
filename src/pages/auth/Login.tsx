import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { APP_PAGES } from '@/config/pages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import commandLogo from '@/assets/command-logo.png';


export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, session, hasPageAccess } = useAuth();
  const navigate = useNavigate();

  // Redirect when session becomes available — to boas-vindas
  useEffect(() => {
    if (session) {
      navigate('/boas-vindas', { replace: true });
    }
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await login(email, password);
    
    if (!error) {
      toast.success('Login realizado com sucesso!');
      // Navigation handled by useEffect when session updates
    } else {
      toast.error(error);
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 gap-8"
      style={{ background: 'linear-gradient(135deg, #0039d8 0%, #00053d 100%)' }}
    >
      <img 
        src={commandLogo} 
        alt="Command OS" 
        className="h-14 w-auto brightness-0 invert"
      />

      <Card className="w-full max-w-md bg-card/95 backdrop-blur-sm border-border">
        <CardHeader className="text-center space-y-1.5 pb-2">
          <CardTitle className="text-2xl text-foreground">Bem-vindo ao Command OS</CardTitle>
          <CardDescription className="text-muted-foreground leading-relaxed">
            Gestão comercial para audiovisual<br />
            CRM • Propostas • Clientes<br />
            Para produtoras e criadores
          </CardDescription>
        </CardHeader>
        <CardContent>
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
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <PasswordInput
                id="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                Esqueci minha senha
              </Link>
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
            <p className="text-sm text-muted-foreground text-center pt-2">
              Não tem uma conta?{' '}
              <Link to="/cadastro" className="text-primary hover:underline">
                Criar conta
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
      <p className="text-xs text-white/70 text-center space-x-4">
        <Link to="/privacidade" className="hover:underline">Política de Privacidade</Link>
        <Link to="/termos" className="hover:underline">Termos de Uso</Link>
      </p>
    </div>
  );
}
