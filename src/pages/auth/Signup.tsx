import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import commandLogo from '@/assets/command-logo.png';

export function Signup() {
  const [name, setName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const validate = (): string | null => {
    if (!name.trim()) return 'Informe seu nome.';
    if (!workspaceName.trim()) return 'Informe o nome da empresa.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return 'Informe um e-mail válido.';
    if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return 'A senha deve conter letras e números.';
    }
    if (password !== confirmPassword) return 'As senhas não coincidem.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsLoading(true);

    const { error, needsEmailConfirmation } = await signup(email.trim(), password, name.trim(), workspaceName.trim());

    if (!error && needsEmailConfirmation) {
      toast.success('Conta criada! Confirme seu e-mail pelo link que enviamos e depois faça login.');
      navigate('/login');
    } else if (!error) {
      toast.success('Conta criada com sucesso!');
      navigate('/boas-vindas');
    } else {
      toast.error(error);
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-sidebar-background flex flex-col items-center justify-center p-4 gap-8">
      <img 
        src={commandLogo} 
        alt="Command CRM" 
        className="h-14 w-auto dark:brightness-0 dark:invert"
      />

      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center space-y-1.5 pb-2">
          <CardTitle className="text-2xl text-foreground">Criar Conta</CardTitle>
          <CardDescription className="text-muted-foreground leading-relaxed">
            Crie sua conta e seu espaço de trabalho.<br />
            Você será o administrador principal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Seu Nome</Label>
              <Input
                id="name"
                type="text"
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspaceName">Nome da Empresa</Label>
              <Input
                id="workspaceName"
                type="text"
                placeholder="Nome da sua empresa ou produtora"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <PasswordInput
                id="password"
                placeholder="Mínimo 8 caracteres, com letras e números"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <PasswordInput
                id="confirmPassword"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? 'Criando...' : 'Criar Conta'}
            </Button>
            <p className="text-sm text-muted-foreground text-center pt-2">
              Já tem uma conta?{' '}
              <Link to="/" className="text-primary hover:underline">
                Fazer login
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
