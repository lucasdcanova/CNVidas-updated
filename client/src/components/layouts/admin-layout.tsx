import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { 
  User, LogOut, Home, Users, CreditCard, Briefcase, 
  Activity, ClipboardList, QrCode, TrendingUp, Menu, X, ShoppingCart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger, 
  SheetHeader, 
  SheetTitle 
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    logoutMutation.mutate();
  };

  // Se não for admin, redireciona para login
  if (user?.role !== "admin") {
    navigate("/auth");
    return null;
  }

  // Lista de links do menu administrativo
  const navLinks = [
    { href: "/admin/dashboard", icon: Home, label: "Dashboard", description: "Visão geral do sistema" },
    { href: "/admin/users", icon: Users, label: "Usuários", description: "Gerenciar usuários" },
    { href: "/admin/partners", icon: Briefcase, label: "Parceiros", description: "Gerenciar parceiros" },
    { href: "/admin/services", icon: Activity, label: "Serviços", description: "Serviços disponíveis" },
    { href: "/admin/claims", icon: ClipboardList, label: "Sinistros", description: "Gestão de sinistros" },
    { href: "/admin/checkout-tracking", icon: ShoppingCart, label: "Monitorar Checkouts", description: "Acompanhar pagamentos" },
    { href: "/admin/qr-auth-logs", icon: QrCode, label: "Logs QR Code", description: "Logs de autenticação" },
    { href: "/admin/seller-stats", icon: TrendingUp, label: "Vendedores", description: "Estatísticas de vendas" },
    { href: "/admin/analytics", icon: CreditCard, label: "Relatórios", description: "Análises e relatórios" },
  ];

  const NavigationItem = ({ 
    href, 
    icon: Icon, 
    label, 
    description, 
    isActive, 
    onClick 
  }: { 
    href: string; 
    icon: any; 
    label: string; 
    description: string; 
    isActive: boolean; 
    onClick?: () => void; 
  }) => (
    <Link href={href}>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent cursor-pointer",
          isActive ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground"
        )}
        onClick={onClick}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="truncate">{label}</span>
          <span className="text-xs text-muted-foreground hidden lg:block truncate">{description}</span>
        </div>
      </div>
    </Link>
  );

  const SidebarContent = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <div className="flex h-full flex-col min-h-0">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6 flex-shrink-0">
        <Link href="/admin/dashboard" className="flex items-center gap-2 font-semibold min-w-0">
          <img src={logo} alt="CN Vidas" className="h-8 w-auto flex-shrink-0" />
          <span className="hidden lg:block truncate">Admin</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-2 min-h-0">
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4 gap-1">
          {navLinks.map((link) => (
            <NavigationItem
              key={link.href}
              href={link.href}
              icon={link.icon}
              label={link.label}
              description={link.description}
              isActive={location === link.href}
              onClick={onLinkClick}
            />
          ))}
        </nav>
      </div>
      <div className="mt-auto p-4 flex-shrink-0 border-t bg-muted/20">
        <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 mb-3">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
            <User size={16} />
          </div>
          <div className="flex-1 overflow-hidden min-w-0">
            <p className="text-sm font-medium truncate">{user?.fullName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start" 
          onClick={handleLogout}
          size="sm"
        >
          <LogOut className="mr-2 h-4 w-4 flex-shrink-0" />
          <span className="truncate">Sair</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]">
      {/* Desktop Sidebar */}
      <div className="hidden border-r bg-muted/40 md:block">
        <SidebarContent />
      </div>

      <div className="flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 md:hidden flex-shrink-0">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col w-64 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Menu de Navegação</SheetTitle>
              </SheetHeader>
              <SidebarContent onLinkClick={() => setMobileMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{title}</h1>
          </div>
          
          <Button variant="outline" size="icon" onClick={handleLogout} className="flex-shrink-0">
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Logout</span>
          </Button>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <span className="text-sm text-muted-foreground hidden lg:block truncate">
              Olá, {user?.fullName?.split(' ')[0]}!
            </span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-hidden min-h-0">
          <div className="w-full max-w-none overflow-auto flex-1">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;