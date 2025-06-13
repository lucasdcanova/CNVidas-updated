import React from "react";
import { useLocation, Link } from "wouter";
import cnvidasLogo from "@/assets/cnvidas-logo-transparent.png";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left side with form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        {/* Background gradient blobs */}
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-400 opacity-10 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-20 -right-20 w-80 h-80 bg-green-400 opacity-10 rounded-full filter blur-3xl"></div>
        
        <div className="max-w-md w-full relative z-10">
          <div className="flex justify-center mb-8">
            <img 
              src={cnvidasLogo} 
              alt="CN Vidas" 
              className="h-16 w-auto" 
            />
          </div>
          
          <div className="glass-morphism rounded-2xl overflow-hidden">
            {children}
          </div>
          
          <div className="text-center mt-8 text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} CN Vidas. Todos os direitos reservados.
          </div>
        </div>
      </div>
      
      {/* Right side with background hero */}
      <div className="hidden lg:block lg:w-1/2 bg-gradient-blue-green relative overflow-hidden">
        <div className="absolute inset-0 bg-pattern opacity-10"></div>
        <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-white/10 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-20 bg-gradient-to-t from-black/20 to-transparent"></div>
        
        <div className="absolute inset-0 flex flex-col justify-center items-center p-12 text-white">
          <div className="absolute w-40 h-40 bg-white/10 rounded-full top-20 -right-10 filter blur-md"></div>
          <div className="absolute w-32 h-32 bg-white/10 rounded-full bottom-20 -left-10 filter blur-md"></div>
          
          <h2 className="text-4xl font-bold mb-6 text-center">Cuidando de você por completo</h2>
          <p className="text-xl mb-8 text-center max-w-lg">
            Plataforma integrada de saúde com serviços completos para seu bem-estar físico e mental.
          </p>
          
          <div className="w-full max-w-md bg-white/20 backdrop-blur-md rounded-xl p-8 shadow-lg border border-white/30">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center backdrop-blur-sm shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-lg">Ecossistema Completo</h3>
                <p className="text-sm text-white/90">Consultas, exames e serviços integrados</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center backdrop-blur-sm shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-lg">Serviços com Desconto</h3>
                <p className="text-sm text-white/90">Economize em clínicas e farmácias parceiras</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center backdrop-blur-sm shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-lg">Seguros e Coberturas</h3>
                <p className="text-sm text-white/90">Processamento rápido de sinistros e reembolsos</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center backdrop-blur-sm shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-lg">Telemedicina 24/7</h3>
                <p className="text-sm text-white/90">Atendimento especializado a qualquer hora</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
