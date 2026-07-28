import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { ProfileEditDialog } from '@/components/profile/ProfileEditDialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  LayoutGrid,
  UserCog,
  Layers,
  ChevronDown,
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
      { name: 'Calendário de Projetos', href: '/calendario', icon: CalendarDays, pageKey: 'calendario' },
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

  const getDefaultOpen = () => {
    const open: Record<string, boolean> = {};
    filteredNavGroups.forEach((group) => {
      open[group.label] = group.items.some((item) => isParentActive(item.href));
    });
    if (!Object.values(open).some(Boolean) && filteredNavGroups.length > 0) {
      open[filteredNavGroups[0].label] = true;
    }
    return open;
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(getDefaultOpen);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

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
      <nav className="flex-1 px-4 pt-6 space-y-4 overflow-y-auto scrollbar-thin">
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
          <div key={group.label}>
            <button
              onClick={() => toggleGroup(group.label)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors rounded-lg"
            >
              <div className="flex items-center gap-2">
                <group.icon className="w-4 h-4" />
                <span>{group.label}</span>
              </div>
              <motion.div
                animate={{ rotate: openGroups[group.label] ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {openGroups[group.label] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-1 space-y-0.5 pl-2">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.name}
                        to={item.href}
                        onClick={handleNavClick}
                        className={`nav-link ${isParentActive(item.href) ? 'active' : ''}`}
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{item.name}</span>
                      </NavLink>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
