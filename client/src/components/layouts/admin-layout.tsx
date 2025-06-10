import React, { useState } from "react";
import { useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import SidebarNavigation from "@/components/shared/sidebar-navigation";
import UserProfile from "@/components/shared/user-profile";
import logo from "@assets/Logotipo_cnvidas_comprido_transparent_advanced_fuzz3.png";

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title = "Painel Administrativo" }) => {
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    // Simplesmente chamar o logout - a função já cuida de redirecionar
    logoutMutation.mutate();
  };

  // Se não for admin, redireciona para login
  if (user?.role !== "admin") {
    navigate("/auth");
    return null;
  }


  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-blue-50 to-slate-50 bg-subtle-grid">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden transition-opacity duration-300 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 md:relative md:flex md:flex-col md:w-64 glass-sidebar shadow-lg transition-transform transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-5 border-b border-gray-100/50 flex items-center">
          <img src={logo} alt="CN Vidas" className="h-9 w-auto" />
          <button
            className="ml-auto md:hidden text-gray-500 hover:text-gray-700 transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarNavigation userRole="admin" />
        <div className="mt-auto p-4 border-t border-gray-100/50">
          <UserProfile user={user} />
        </div>
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden relative z-10">
        <header className="glass-nav sticky top-0 z-10 shadow-sm">
          <div className="md:hidden flex items-center justify-between p-4">
            <button
              type="button"
              className="text-gray-600 hover:text-gray-800 focus:outline-none transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <img src={logo} alt="CN Vidas" className="h-8 w-auto" />
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          <div className="hidden md:flex items-center justify-between px-6 py-4">
            <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
            <UserProfile user={user} compact />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout

