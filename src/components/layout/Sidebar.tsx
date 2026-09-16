import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { ProfileEditDialog } from '@/components/profile/ProfileEditDialog';
import {
  Users,
  LayoutGrid,
  UserCog,
  Layers,
  Briefcase,
  Target,
  TrendingUp,
  Info,
  Package,
  Award,
  Settings,
  Scale,
  FileImage,
  LogOut,
  CalendarDays,
  HardDrive,
  Wrench,
  DollarSign,
  Building2,
  ShieldCheck,
  Sparkles,
  History as HistoryIcon,
} from 'lucide-react';
import commandLogo from '@/assets/command-logo.png';
import { useAuth } from '@/contexts/AuthContext';
import { APP_PAGES } from '@/config/pages';
import { useNavigate } from 'react-router-dom';

interface NavGroup {
  label: string;
  icon: typeof Users;
  items: {
    name: string;
    href: string;
    icon: typeof Users;
    pageKey: string;
  }[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Comercial',
    icon: Briefcase,
    items: [
      { name: 'Gestão de Leads', href: '/prospeccao', icon: Target, pageKey: 'prospeccao' },
      { name: 'Empresas Cadastradas', href: '/clientes', icon: Users, pageKey: 'clientes' },
      { name: 'CRM', href: '/crm', icon: LayoutGrid, pageKey: 'crm' },
      { name: 'Dashboard', href: '/crm/dashboard', icon: TrendingUp, pageKey: 'crm' },
    ],
  },
  {
    label: 'Projetos',
    icon: Wrench,
    items: [
      { name: 'Área de Projetos', href: '/gestao-projetos', icon: LayoutGrid, pageKey: 'gestao-projetos' },
      
      { name: 'Calendário do Time', href: '/calendario-time', icon: Users, pageKey: 'calendario-time' },
      { name: 'Central de Mídias', href: '/central-midia', icon: HardDrive, pageKey: 'central-midia' },
      { name: 'Histórico', href: '/projetos/historico', icon: HistoryIcon, pageKey: 'historico-projetos' },
    ],
  },
  {
    label: 'Administrativo',
    icon: ShieldCheck,
    items: [
      { name: 'Financeiro', href: '/financeiro', icon: DollarSign, pageKey: 'financeiro' },
      { name: 'Financeiro do Time', href: '/financeiro-time', icon: Users, pageKey: 'financeiro-time' },
      { name: 'Patrimônio', href: '/patrimonio', icon: Building2, pageKey: 'patrimonio' },
    ],
  },
  {
    label: 'Configurações',
    icon: Settings,
    items: [
      { name: 'Categorias de Serviço', href: '/categorias', icon: Layers, pageKey: 'categorias' },
      { name: 'Itens de Serviço', href: '/itens-servico', icon: Package, pageKey: 'itens-servico' },
      { name: 'Regras Comerciais', href: '/configuracoes/regras-comerciais', icon: Scale, pageKey: 'regras-comerciais' },
      { name: 'Layout do PDF', href: '/configuracoes/layout', icon: FileImage, pageKey: 'layout' },
      { name: 'Metas', href: '/configuracoes/metas', icon: Target, pageKey: 'metas' },
      { name: 'Score', href: '/configuracoes/score', icon: Award, pageKey: 'score' },
      { name: 'Minuta de Contrato', href: '/configuracoes/contrato', icon: FileImage, pageKey: 'contrato' },
    ],
  },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPageAccess, role, profile, logout } = useAuth();

  const isParentActive = (href: string) => location.pathname.startsWith(href);

  const filteredNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasPageAccess(item.pageKey)),
    }))
    .filter((group) => group.items.length > 0);

  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const showUsuarios = role === 'owner';

  const handleNavClick = () => {
    onNavigate?.();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 md:w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={commandLogo} alt="Command CRM" className="h-14 w-auto dark:brightness-0 dark:invert" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-5 pb-4 space-y-4 overflow-y-auto scrollbar-thin">
        {hasPageAccess('boas-vindas') && (
          <NavLink
            to="/boas-vindas"
            onClick={handleNavClick}
            className={`nav-link w-full ${location.pathname === '/boas-vindas' ? 'active' : ''}`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-medium">Boas-vindas</span>
          </NavLink>
        )}
        {hasPageAccess('meu-calendario') && (
          <NavLink
            to="/meu-calendario"
            onClick={handleNavClick}
            className={`nav-link w-full ${location.pathname === '/meu-calendario' ? 'active' : ''}`}
          >
            <CalendarDays className="w-5 h-5" />
            <span className="text-sm font-medium">Meu Calendário</span>
          </NavLink>
        )}
        {filteredNavGroups.map((group) => (
          <div key={group.label} className="pt-1">
            <div className="flex items-center gap-2 px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
              <group.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{group.label}</span>
              <span className="flex-1 h-px bg-sidebar-border/70 ml-1" />
            </div>
            <div className="space-y-0.5 pl-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={handleNavClick}
                  className={`nav-link ${isParentActive(item.href) ? 'active' : ''}`}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium truncate">{item.name}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}

      </nav>

      {/* Footer with user info */}
      <div className="px-4 py-4 border-t border-sidebar-border space-y-1">
        {showUsuarios && (
          <NavLink
            to="/usuarios"
            onClick={handleNavClick}
            className={`nav-link w-full ${location.pathname === '/usuarios' ? 'active' : ''}`}
          >
            <UserCog className="w-5 h-5" />
            <span className="text-sm font-medium">Usuários</span>
          </NavLink>
        )}
        <NavLink
          to="/sobre"
          onClick={handleNavClick}
          className={`nav-link w-full ${location.pathname === '/sobre' ? 'active' : ''}`}
        >
          <Info className="w-5 h-5" />
          <span className="text-sm font-medium">Sobre</span>
        </NavLink>

        {/* User profile & logout (visible on mobile) */}
        <div className="pt-2 mt-2 border-t border-sidebar-border md:hidden">
          <div
            className="flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg hover:bg-sidebar-accent transition-colors"
            onClick={() => setProfileDialogOpen(true)}
          >
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
              {profile ? getInitials(profile.name) : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{profile?.name || 'Usuário'}</p>
              <p className="text-xs text-muted-foreground">Editar perfil</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="nav-link w-full text-destructive hover:text-destructive"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Sair</span>
          </button>
        </div>

        <ProfileEditDialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />
      </div>
    </aside>
  );
}
