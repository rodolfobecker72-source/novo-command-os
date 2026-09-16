import { useState } from 'react';
import { LogOut, Menu, UserPen, Wallet } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileEditDialog } from '@/components/profile/ProfileEditDialog';
import { TutorialButton } from '@/components/layout/TutorialButton';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

interface OutletContextType {
  onOpenMobileMenu?: () => void;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { profile, logout, role } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  let onOpenMobileMenu: (() => void) | undefined;
  try {
    const ctx = useOutletContext<OutletContextType>();
    onOpenMobileMenu = ctx?.onOpenMobileMenu;
  } catch {
    // not inside outlet context
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 h-14 md:h-16 bg-background/80 backdrop-blur-sm border-b border-border/40 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu trigger */}
        {onOpenMobileMenu && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0 -ml-1"
            onClick={onOpenMobileMenu}
          >
            <Menu className="w-5 h-5" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold text-foreground tracking-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-muted-foreground truncate hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2 shrink-0">

        {/* Tutorial da página */}
        <TutorialButton fallbackTitle={title} />

        {/* User Menu - visible on all viewports */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl ml-1">
              <Avatar className="w-8 h-8">
                <AvatarImage src={profile?.photo_url || undefined} alt={profile?.name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {profile ? getInitials(profile.name) : 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setProfileOpen(true)}>
              <UserPen className="w-4 h-4 mr-2" />
              Meu Perfil
            </DropdownMenuItem>
            {role && role !== 'owner' && teamFinanceEnabled && (
              <DropdownMenuItem onClick={() => navigate('/meu-financeiro')}>
                <Wallet className="w-4 h-4 mr-2" />
                Meu Financeiro
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ProfileEditDialog open={profileOpen} onOpenChange={setProfileOpen} />
      </div>
    </header>
  );
}
