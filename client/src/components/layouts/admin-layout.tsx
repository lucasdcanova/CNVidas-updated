import React from "react";
import { useLocation, Link } from "wouter";
import { User, LogOut, Home, Users, CreditCard, Briefcase, Stethoscope, Activity, ClipboardList, QrCode, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import logo from "@assets/Logotipo_cnvidas_comprido_transparent_advanced_fuzz3.png";

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title = "Painel Administrativo" }) => {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [location] = useLocation();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      navigate("/auth");
    } catch (error) {
      toast({
        title: "Erro ao sair",
        description: "Não foi possível efetuar o logout. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Se não for admin, redireciona para login
  if (user?.role !== "admin") {
    navigate("/auth");
    return null;
  }

  // Lista de links do menu administrativo
  const navLinks = [
    { href: "/admin/dashboard", icon: <Home size={20} />, label: "Dashboard" },
    { href: "/admin/users", icon: <Users size={20} />, label: "Usuários" },
    { href: "/admin/partners", icon: <Briefcase size={20} />, label: "Parceiros" },
    { href: "/admin/services", icon: <Activity size={20} />, label: "Serviços" },
    { href: "/admin/claims", icon: <ClipboardList size={20} />, label: "Sinistros" },
    { href: "/admin/qr-auth-logs", icon: <QrCode size={20} />, label: "Logs QR Code" },
    { href: "/admin/seller-stats", icon: <TrendingUp size={20} />, label: "Vendedores" },
    { href: "/admin/analytics", icon: <CreditCard size={20} />, label: "Relatórios" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-col flex-grow pt-5 overflow-y-auto bg-white border-r">
          <div className="px-4 mb-6">
            <img src={logo} alt="CN Vidas" className="h-10 object-contain" />
          </div>
          <div className="flex flex-col flex-1 px-4 space-y-1">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className={`flex items-center px-4 py-3 rounded-lg text-sm ${
                  location === link.href
                    ? "bg-primary text-white font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="mr-3">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
          <div className="p-4 mt-auto">
            <Button 
              variant="outline" 
              className="w-full flex items-center justify-center" 
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
            <div className="mt-4 px-2">
              <p className="text-xs text-gray-500 mb-1">Acessado como:</p>
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary mr-2">
                  <User size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium">{user?.fullName}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1">
        {/* Mobile header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white border-b md:hidden">
          <img src={logo} alt="CN Vidas" className="h-8 object-contain" />
          <Button variant="outline" size="icon" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-900">{title}</h1>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;