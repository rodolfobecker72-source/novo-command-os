import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CRMProvider } from "@/contexts/CRMContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PageGuard } from "@/components/auth/PageGuard";
import { Login } from "@/pages/auth/Login";
import { Signup } from "@/pages/auth/Signup";
import { ForgotPassword } from "@/pages/auth/ForgotPassword";
import { ResetPassword } from "@/pages/auth/ResetPassword";
import { ClientDashboard } from "@/pages/clients/ClientDashboard";
import { NewClient } from "@/pages/clients/NewClient";
import { EditClient } from "@/pages/clients/EditClient";
import { ClientDetail } from "@/pages/clients/ClientDetail";
import { CRMKanban } from "@/pages/crm/CRMKanban";
import { CRMDashboard } from "@/pages/crm/CRMDashboard";
import { NewBudget } from "@/pages/crm/NewBudget";
import { BudgetDetail } from "@/pages/crm/BudgetDetail";
import { ServiceCategories } from "@/pages/crm/ServiceCategories";
import { UsersPage } from "@/pages/users/UsersPage";
import { ServiceItemsPage } from "@/pages/crm/ServiceItemsPage";
import { ProspectionPage } from "@/pages/prospection/ProspectionPage";
import { AboutPage } from "@/pages/about/AboutPage";
import { CommercialRulesPage } from "@/pages/settings/CommercialRulesPage";
import { LayoutPage } from "@/pages/settings/LayoutPage";
import { GoalsPage } from "@/pages/settings/GoalsPage";
import { ScorePage } from "@/pages/settings/ScorePage";
import { ContractTemplatePage } from "@/pages/settings/ContractTemplatePage";
import { CalendarPage } from "@/pages/operation/CalendarPage";
import { TeamCalendarPage } from "@/pages/operation/TeamCalendarPage";
import { MediaCenterPage } from "@/pages/operation/MediaCenterPage";
import { ProjectManagementPage } from "@/pages/projects/ProjectManagementPage";
import { ProjectHistoryPage } from "@/pages/projects/ProjectHistoryPage";
import { FinancialPage } from '@/pages/admin/FinancialPage';
import { PatrimonioPage } from '@/pages/admin/PatrimonioPage';
import { SystemAdminPage } from '@/pages/admin/SystemAdminPage';
import { ProspectionProvider } from "@/contexts/ProspectionContext";
import MyFinancePage from "@/pages/MyFinancePage";
import { WelcomePage } from "@/pages/welcome/WelcomePage";
import { MyCalendarPage } from "@/pages/welcome/MyCalendarPage";
import GoogleCalendarCallback from "@/pages/GoogleCalendarCallback";

import { MaintenancePage } from "@/pages/MaintenancePage";
import PublicProjectPage from "@/pages/public/PublicProjectPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CRMProvider>
            <ProspectionProvider>
            <Routes>
              {/* Auth */}
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/cadastro" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Public project view (no auth) */}
              <Route path="/p/projeto/:cardId" element={<PublicProjectPage />} />

              {/* Google Calendar OAuth popup callback (public — just closes) */}
              <Route path="/auth/google-calendar-callback" element={<GoogleCalendarCallback />} />
              
              
              
              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                
                {/* App routes with sidebar layout */}
                <Route element={<AppLayout />}>
                  {/* Início */}
                  <Route path="/boas-vindas" element={<PageGuard pageKey="boas-vindas"><WelcomePage /></PageGuard>} />
                  <Route path="/meu-calendario" element={<PageGuard pageKey="meu-calendario"><MyCalendarPage /></PageGuard>} />

                  {/* Prospecção */}
                  <Route path="/prospeccao" element={<PageGuard pageKey="prospeccao"><ProspectionPage /></PageGuard>} />
                  
                  {/* Clients */}
                  <Route path="/clientes" element={<PageGuard pageKey="clientes"><ClientDashboard /></PageGuard>} />
                  <Route path="/clientes/novo" element={<PageGuard pageKey="clientes"><NewClient /></PageGuard>} />
                  <Route path="/clientes/:id" element={<PageGuard pageKey="clientes"><ClientDetail /></PageGuard>} />
                  <Route path="/clientes/:id/editar" element={<PageGuard pageKey="clientes"><EditClient /></PageGuard>} />
                  
                  {/* CRM */}
                  <Route path="/crm" element={<PageGuard pageKey="crm"><CRMKanban /></PageGuard>} />
                  <Route path="/crm/dashboard" element={<PageGuard pageKey="crm"><CRMDashboard /></PageGuard>} />
                  <Route path="/crm/orcamento/novo" element={<PageGuard pageKey="crm"><NewBudget /></PageGuard>} />
                  <Route path="/crm/orcamento/:id" element={<PageGuard pageKey="crm"><BudgetDetail /></PageGuard>} />
                  
                  {/* Service Categories */}
                  <Route path="/categorias" element={<PageGuard pageKey="categorias"><ServiceCategories /></PageGuard>} />
                  
                  {/* Service Items */}
                  <Route path="/itens-servico" element={<PageGuard pageKey="itens-servico"><ServiceItemsPage /></PageGuard>} />
                  
                  {/* Operação */}
                  <Route path="/gestao-projetos" element={<PageGuard pageKey="gestao-projetos"><ProjectManagementPage /></PageGuard>} />
                  <Route path="/projetos/historico" element={<PageGuard pageKey="historico-projetos"><ProjectHistoryPage /></PageGuard>} />
                  <Route path="/calendario" element={<PageGuard pageKey="calendario"><CalendarPage /></PageGuard>} />
                  <Route path="/calendario-time" element={<PageGuard pageKey="calendario-time"><TeamCalendarPage /></PageGuard>} />
                  <Route path="/central-midia" element={<PageGuard pageKey="central-midia"><MediaCenterPage /></PageGuard>} />
                  
                  {/* Administrativo */}
                  <Route path="/financeiro" element={<PageGuard pageKey="financeiro"><FinancialPage /></PageGuard>} />
                  <Route path="/patrimonio" element={<PageGuard pageKey="patrimonio"><PatrimonioPage /></PageGuard>} />
                  <Route path="/admin-sistema" element={<SystemAdminPage />} />

                  {/* Users */}
                  <Route path="/usuarios" element={<PageGuard pageKey="usuarios"><UsersPage /></PageGuard>} />
                  
                  {/* Settings */}
                  <Route path="/configuracoes/regras-comerciais" element={<PageGuard pageKey="regras-comerciais"><CommercialRulesPage /></PageGuard>} />
                  <Route path="/configuracoes/layout" element={<PageGuard pageKey="layout"><LayoutPage /></PageGuard>} />
                  <Route path="/configuracoes/metas" element={<PageGuard pageKey="metas"><GoalsPage /></PageGuard>} />
                  <Route path="/configuracoes/score" element={<PageGuard pageKey="score"><ScorePage /></PageGuard>} />
                  <Route path="/configuracoes/contrato" element={<PageGuard pageKey="contrato"><ContractTemplatePage /></PageGuard>} />
                  
                  {/* About */}
                  <Route path="/sobre" element={<AboutPage />} />

                  {/* Meu Financeiro (avatar menu) */}
                  <Route path="/meu-financeiro" element={<MyFinancePage />} />
                </Route>
              </Route>
              
              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </ProspectionProvider>
          </CRMProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
