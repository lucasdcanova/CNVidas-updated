import * as React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Telemedicine from "@/pages/telemedicine";
import TelemedicinePage from "@/pages/telemedicine-page";

import DailyTelemedicine from "@/pages/daily-telemedicine";
import TelemedicineEmergencyPage from "@/pages/telemedicine-emergency";
import TelemedicineEmergencyV2 from "@/pages/telemedicine-emergency-v2";
import TelemedicineEmergencyV3 from "@/pages/telemedicine-emergency-v3";
import TelemedicineEmergencyV4 from "@/pages/telemedicine-emergency-v4";
import TelemedicineEmergencyV4New from "@/pages/telemedicine-emergency-v4-new";
import TelemedicineEmergencyV5 from "@/pages/telemedicine-emergency-v5";
import TelemedicineEmergencyRoomV4 from "@/pages/telemedicine-emergency-room-v4";
import UnifiedEmergencyRoom from "@/pages/unified-emergency-room";
import TelemedicineConsultation from "@/pages/telemedicine-consultation";
import EmergencyCallPage from "@/pages/emergency-call";
import Claims from "@/pages/claims";
import NewClaim from "@/pages/claims/new"; 
import Services from "@/pages/services";
import Profile from "@/pages/profile";
import Address from "@/pages/address";
import Checkout from "@/pages/checkout";
import Subscribe from "@/pages/subscribe";
import Subscription from "@/pages/subscription";
import FirstSubscription from "@/pages/first-subscription";
import PaymentSuccess from "@/pages/payment-success";
import SubscriptionSuccess from "@/pages/subscription-success";
import HelpPage from "@/pages/help";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminPartners from "@/pages/admin/partners";
import AdminClaims from "@/pages/admin/claims";
import AdminServices from "@/pages/admin/services";
import AdminAnalytics from "@/pages/admin/analytics";
import QrAuthLogs from "@/pages/admin/qr-auth-logs";
import AdminSubscriptionPlans from "@/pages/admin/subscription-plans";
import AdminUserDependents from "@/pages/admin/users/dependents";
import SellerStats from "@/pages/admin/seller-stats";
import DoctorTelemedicine from "@/pages/doctor-telemedicine";
import DoctorAvailability from "@/pages/doctor-availability";
import DoctorEmergencyRoom from "@/pages/doctor-emergency-room";
import DoctorEmergencyRoomPage from "@/pages/doctor-emergency-room";
import DoctorDirectEmergency from "@/pages/doctor-direct-emergency";
import DoctorWelcome from "@/pages/doctor/welcome";
import DoctorFinanceiro from "@/pages/doctor/financeiro";
import PartnerDashboard from "@/pages/partner-dashboard";
import PartnerVerification from "@/pages/partner-verification";
import PartnerServices from "@/pages/partner-services";
import QRCodePage from "@/pages/qr-code";
import PatientSettings from "@/pages/patient/settings";
import DependentsPage from "@/pages/dependents-page-responsive";
import VerificarEmail from "@/pages/verificar-email";
import RedefinirSenha from "@/pages/redefinir-senha";
import ReenviarVerificacao from "@/pages/reenviar-verificacao";
import EsqueciSenha from "@/pages/esqueci-senha";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      {/* Verificação de Email e Redefinição de Senha - Acessíveis sem autenticação */}
      <Route path="/verificar-email" component={VerificarEmail} />
      <Route path="/redefinir-senha" component={RedefinirSenha} />
      <Route path="/reenviar-verificacao" component={ReenviarVerificacao} />
      <Route path="/esqueci-senha" component={EsqueciSenha} />
      
      {/* Patient & General Routes */}
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/telemedicine" component={TelemedicinePage} allowedRoles={["patient"]} />

      <ProtectedRoute path="/daily-telemedicine/:appointmentId" component={DailyTelemedicine} />
      <ProtectedRoute path="/telemedicine-emergency" component={TelemedicineEmergencyPage} allowedRoles={["patient"]} />
      <ProtectedRoute path="/emergency-v2" component={TelemedicineEmergencyV2} allowedRoles={["patient"]} />
      <ProtectedRoute path="/emergency-v3" component={TelemedicineEmergencyV3} allowedRoles={["patient"]} />
      <ProtectedRoute path="/telemedicine-emergency-v4/:id" component={TelemedicineEmergencyV4New} allowedRoles={["patient", "doctor"]} />
      <ProtectedRoute path="/telemedicine-emergency-v5/:id" component={TelemedicineEmergencyV5} allowedRoles={["patient", "doctor"]} />
      <ProtectedRoute path="/unified-emergency-room" component={UnifiedEmergencyRoom} allowedRoles={["doctor", "patient"]} />
      <ProtectedRoute path="/emergency-room-v4" component={TelemedicineEmergencyRoomV4} allowedRoles={["doctor", "patient"]} />
      <ProtectedRoute path="/emergency-room-v4/:id" component={TelemedicineEmergencyRoomV4} allowedRoles={["doctor", "patient"]} />
      <ProtectedRoute path="/claims" component={Claims} allowedRoles={["patient"]} />
      <ProtectedRoute path="/claims/new" component={NewClaim} allowedRoles={["patient"]} />
      <ProtectedRoute path="/services" component={Services} allowedRoles={["patient"]} />
      <ProtectedRoute path="/profile" component={Profile} />
      <ProtectedRoute path="/address" component={Address} />
      <ProtectedRoute path="/settings" component={PatientSettings} allowedRoles={["patient"]} />
      <ProtectedRoute path="/dependents" component={DependentsPage} allowedRoles={["patient"]} />
      <ProtectedRoute path="/qr-code" component={QRCodePage} allowedRoles={["patient", "partner"]} />
      <ProtectedRoute path="/help" component={HelpPage} />
      <ProtectedRoute path="/checkout" component={Checkout} />
      <ProtectedRoute path="/subscribe" component={Subscribe} />
      <ProtectedRoute path="/subscription" component={Subscription} />
      <ProtectedRoute path="/first-subscription" component={FirstSubscription} allowedRoles={["patient"]} />
      <ProtectedRoute path="/payment-success" component={PaymentSuccess} />
      <ProtectedRoute path="/subscription-success" component={SubscriptionSuccess} />

      {/* Doctor Routes */}
      <ProtectedRoute path="/doctor" component={DoctorTelemedicine} allowedRoles={["doctor"]} />
      <ProtectedRoute path="/doctor/welcome" component={DoctorWelcome} allowedRoles={["doctor"]} />
      <ProtectedRoute path="/doctor/financeiro" component={DoctorFinanceiro} allowedRoles={["doctor"]} />
      <ProtectedRoute path="/doctor-telemedicine" component={DoctorTelemedicine} allowedRoles={["doctor"]} />
      <ProtectedRoute path="/doctor-availability" component={DoctorAvailability} allowedRoles={["doctor"]} />
      <ProtectedRoute path="/doctor-emergency" component={TelemedicineEmergencyV3} allowedRoles={["doctor", "patient"]} />
      <ProtectedRoute path="/doctor-direct" component={DoctorDirectEmergency} allowedRoles={["doctor"]} />
      <ProtectedRoute path="/doctor-direct-emergency" component={DoctorDirectEmergency} allowedRoles={["doctor"]} />
      
      {/* Telemedicine Room com Daily.co - Nova implementação com melhor conexão */}
      <ProtectedRoute path="/telemedicine/:appointmentId" component={DailyTelemedicine} allowedRoles={["doctor", "patient"]} />
      
      {/* Nova implementação reescrita com melhores práticas do Daily.co */}
      <ProtectedRoute path="/consultation/:id" component={TelemedicineConsultation} allowedRoles={["doctor", "patient"]} />
      
      {/* Sala de Emergência Daily.co */}
      <ProtectedRoute path="/emergency-call" component={EmergencyCallPage} allowedRoles={["patient", "doctor"]} />
      
      {/* Sala de Emergência específica do médico */}
      <ProtectedRoute path="/emergency/doctor/:doctorId" component={DoctorEmergencyRoomPage} allowedRoles={["patient", "doctor"]} />
      
      {/* Partner Routes */}
      <ProtectedRoute path="/partner/dashboard" component={PartnerDashboard} allowedRoles={["partner"]} />
      <ProtectedRoute path="/partner/verification" component={PartnerVerification} allowedRoles={["partner"]} />
      <ProtectedRoute path="/partner/services" component={PartnerServices} allowedRoles={["partner"]} />
      
      {/* Admin Routes */}
      <ProtectedRoute path="/admin" component={AdminDashboard} allowedRoles={["admin"]} />
      <ProtectedRoute path="/admin/dashboard" component={AdminDashboard} allowedRoles={["admin"]} />
      <ProtectedRoute path="/admin/users" component={AdminUsers} allowedRoles={["admin"]} />
      <ProtectedRoute path="/admin/users/dependents/:userId" component={AdminUserDependents} allowedRoles={["admin"]} />
      <ProtectedRoute path="/admin/partners" component={AdminPartners} allowedRoles={["admin"]} />
      <ProtectedRoute path="/admin/services" component={AdminServices} allowedRoles={["admin"]} />
      <ProtectedRoute path="/admin/claims" component={AdminClaims} allowedRoles={["admin"]} />
      <ProtectedRoute path="/admin/qr-auth-logs" component={QrAuthLogs} allowedRoles={["admin"]} />
      <ProtectedRoute path="/admin/analytics" component={AdminAnalytics} allowedRoles={["admin"]} />
      <ProtectedRoute path="/admin/subscription-plans" component={AdminSubscriptionPlans} allowedRoles={["admin"]} />
      <ProtectedRoute path="/admin/seller-stats" component={SellerStats} allowedRoles={["admin"]} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
