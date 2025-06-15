import React from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Video, 
  ClipboardList, 
  Stethoscope, 
  Users, 
  Building2, 
  FileText, 
  BarChart3, 
  Calendar, 
  QrCode, 
  User, 
  Settings, 
  HelpCircle,
  CreditCard,
  UserPlus,
  ShoppingCart,
  History,
  Activity,
  FolderOpen
} from "lucide-react";

interface SidebarNavigationProps {
  userRole?: string;
  subscriptionPlan?: string;
}

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({ userRole = "patient", subscriptionPlan }) => {
  const [location] = useLocation();
  
  const isLinkActive = (path: string) => {
    return location === path;
  };

  const sectionTitleClass = "text-xs font-semibold text-primary/70 uppercase tracking-wider mb-3 mt-6 px-4";
  const linkBaseClass = "flex items-center px-4 py-2.5 text-sm font-medium rounded-lg my-1 transition-all duration-200";
  const linkActiveClass = "bg-white/50 text-primary shadow-sm backdrop-blur-sm border border-white/20";
  const linkInactiveClass = "text-gray-600 hover:bg-white/30 hover:text-primary/90";

  return (
    <nav className="flex-1 overflow-y-auto py-6 px-3">
      <div className="space-y-1">
        {/* Dashboard - For patients and partners, not for doctors */}
        {userRole !== "doctor" && (
          <>
            <p className={sectionTitleClass.replace('mt-6', '')}>Principal</p>
            <Link href={
              userRole === "partner" ? "/partner/dashboard" : 
              "/dashboard"
            } 
              className={`${linkBaseClass} ${
                isLinkActive("/dashboard") || 
                isLinkActive("/partner/dashboard")
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <LayoutDashboard className="w-5 h-5 mr-3" />
                Dashboard
            </Link>
          </>
        )}
        
        {/* Geral section - Only for patients */}
        {userRole === "patient" && (
          <>
            <p className={sectionTitleClass}>Serviços</p>
            
            <Link href="/telemedicine" 
              className={`${linkBaseClass} ${
                isLinkActive("/telemedicine") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <Video className="w-5 h-5 mr-3" />
                Telemedicina
            </Link>
            

            
            <Link href="/claims"
              className={`${linkBaseClass} ${
                isLinkActive("/claims") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <ClipboardList className="w-5 h-5 mr-3" />
                Sinistros
            </Link>
            
            <Link href="/services"
              className={`${linkBaseClass} ${
                isLinkActive("/services") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <Stethoscope className="w-5 h-5 mr-3" />
                Serviços
            </Link>
            
            {/* Only show Dependentes for users with family plans */}
            {subscriptionPlan && (subscriptionPlan.includes('_family') || subscriptionPlan === 'ultra_family' || subscriptionPlan === 'premium_family' || subscriptionPlan === 'basic_family') && (
              <Link href="/dependents"
                className={`${linkBaseClass} ${
                  isLinkActive("/dependents") 
                    ? linkActiveClass 
                    : linkInactiveClass
                }`}>
                  <UserPlus className="w-5 h-5 mr-3" />
                  Dependentes
              </Link>
            )}
            
            <Link href="/subscription"
              className={`${linkBaseClass} ${
                isLinkActive("/subscription") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <CreditCard className="w-5 h-5 mr-3" />
                Planos
            </Link>
            
            <Link href="/recent-activities"
              className={`${linkBaseClass} ${
                isLinkActive("/recent-activities") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <Activity className="w-5 h-5 mr-3" />
                Atividades Recentes
            </Link>
          </>
        )}
        
        {/* Admin only links */}
        {userRole === "admin" && (
          <>
            <p className={sectionTitleClass}>Administração</p>
            
            <Link href="/admin/users"
              className={`${linkBaseClass} ${
                isLinkActive("/admin/users") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <Users className="w-5 h-5 mr-3" />
                Usuários
            </Link>
            
            <Link href="/admin/partners"
              className={`${linkBaseClass} ${
                isLinkActive("/admin/partners") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <Building2 className="w-5 h-5 mr-3" />
                Parceiros
            </Link>
            
            <Link href="/admin/claims"
              className={`${linkBaseClass} ${
                isLinkActive("/admin/claims") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <FileText className="w-5 h-5 mr-3" />
                Sinistros
            </Link>
            
            <Link href="/admin/analytics"
              className={`${linkBaseClass} ${
                isLinkActive("/admin/analytics") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <BarChart3 className="w-5 h-5 mr-3" />
                Analytics
            </Link>
            
            <Link href="/admin/subscription-plans"
              className={`${linkBaseClass} ${
                isLinkActive("/admin/subscription-plans") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <CreditCard className="w-5 h-5 mr-3" />
                Planos de Assinatura
            </Link>
            
            <Link href="/admin/checkout-tracking"
              className={`${linkBaseClass} ${
                isLinkActive("/admin/checkout-tracking") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <ShoppingCart className="w-5 h-5 mr-3" />
                Monitorar Checkouts
            </Link>
            
            <Link href="/admin/medical-records"
              className={`${linkBaseClass} ${
                isLinkActive("/admin/medical-records") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <FolderOpen className="w-5 h-5 mr-3" />
                Prontuários Médicos
            </Link>
          </>
        )}
        
        {/* Doctor specific links */}
        {userRole === "doctor" && (
          <>
            <p className={sectionTitleClass}>Médico</p>
            
            <Link href="/doctor-telemedicine"
              className={`${linkBaseClass} ${
                isLinkActive("/doctor-telemedicine") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <Video className="w-5 h-5 mr-3" />
                Teleconsultas
            </Link>
            
            <Link href="/doctor-availability"
              className={`${linkBaseClass} ${
                isLinkActive("/doctor-availability") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <Calendar className="w-5 h-5 mr-3" />
                Disponibilidade
            </Link>
            
            <Link href="/doctor/financeiro"
              className={`${linkBaseClass} ${
                isLinkActive("/doctor/financeiro") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <CreditCard className="w-5 h-5 mr-3" />
                Financeiro
            </Link>
            
            <Link href="/doctor/consultation-history"
              className={`${linkBaseClass} ${
                isLinkActive("/doctor/consultation-history") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <History className="w-5 h-5 mr-3" />
                Histórico de Consultas
            </Link>
            
            <Link href="/doctor/medical-records"
              className={`${linkBaseClass} ${
                isLinkActive("/doctor/medical-records") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <FolderOpen className="w-5 h-5 mr-3" />
                Prontuários
            </Link>
          </>
        )}
        
        {/* Partner specific links */}
        {userRole === "partner" && (
          <>
            <p className={sectionTitleClass}>Gerenciamento</p>
            
            <Link href="/partner/services"
              className={`${linkBaseClass} ${
                isLinkActive("/partner/services") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <Stethoscope className="w-5 h-5 mr-3" />
                Meus Serviços
            </Link>
            
            <Link href="/partner/verification"
              className={`${linkBaseClass} ${
                isLinkActive("/partner/verification") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <QrCode className="w-5 h-5 mr-3" />
                Verificar QR Code
            </Link>
          </>
        )}
        
        <div className="mt-auto">
          <p className={sectionTitleClass}>Conta</p>
          
          <Link href="/profile" 
            className={`${linkBaseClass} ${
              isLinkActive("/profile") 
                ? linkActiveClass 
                : linkInactiveClass
            }`}>
              <User className="w-5 h-5 mr-3" />
              Perfil
          </Link>
          
          {/* Pagamentos disponível apenas para pacientes */}
          {userRole === "patient" && (
            <Link href="/payments" 
              className={`${linkBaseClass} ${
                isLinkActive("/payments") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <CreditCard className="w-5 h-5 mr-3" />
                Pagamentos
            </Link>
          )}
          
          {/* QR Code disponível apenas para pacientes */}
          {userRole === "patient" && (
            <Link href="/qr-code" 
              className={`${linkBaseClass} ${
                isLinkActive("/qr-code") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <QrCode className="w-5 h-5 mr-3" />
                Meu QR Code
            </Link>
          )}
          
          {/* Configurações disponível para pacientes e médicos */}
          {(userRole === "patient" || userRole === "doctor") && (
            <Link href={userRole === "doctor" ? "/doctor/settings" : "/settings"} 
              className={`${linkBaseClass} ${
                isLinkActive("/settings") || isLinkActive("/doctor/settings")
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <Settings className="w-5 h-5 mr-3" />
                Configurações
            </Link>
          )}
          
          {/* Link para Fale Conosco disponível apenas para pacientes */}
          {userRole === "patient" && (
            <Link href="/help" 
              className={`${linkBaseClass} ${
                isLinkActive("/help") 
                  ? linkActiveClass 
                  : linkInactiveClass
              }`}>
                <HelpCircle className="w-5 h-5 mr-3" />
                Fale Conosco
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default SidebarNavigation;
