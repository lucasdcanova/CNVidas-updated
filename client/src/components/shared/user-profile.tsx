import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanIndicator, getPlanColor } from "./plan-indicator";
import { User, UserRole } from "@/shared/types";

interface UserProfileProps {
  user: User | null;
  compact?: boolean;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, compact = false }) => {
  const { logoutMutation } = useAuth();
  
  if (!user) {
    return null;
  }
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  const getUserInitials = () => {
    if (!user.fullName) return "CN";
    const nameParts = user.fullName.split(" ");
    if (nameParts.length === 1) return nameParts[0].charAt(0).toUpperCase();
    return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
  };
  
  const getRoleLabel = () => {
    switch (user.role as UserRole) {
      case "admin":
        return "Administrador";
      case "partner":
        return "Parceiro";
      case "doctor":
        return "Médico";
      case "patient":
      default:
        return "Paciente";
    }
  };
  
  const getRoleBadgeColor = () => {
    switch (user.role as UserRole) {
      case "admin":
        return "bg-gradient-to-r from-purple-500/20 to-purple-700/20 text-purple-700 border border-purple-300/30";
      case "partner":
        return "bg-gradient-to-r from-blue-500/20 to-blue-700/20 text-blue-700 border border-blue-300/30";
      case "doctor":
        return "bg-gradient-to-r from-green-500/20 to-green-700/20 text-green-700 border border-green-300/30";
      case "patient":
      default:
        return "bg-gradient-to-r from-gray-500/20 to-gray-700/20 text-gray-700 border border-gray-300/30";
    }
  };
  
  const getAvatarGradient = () => {
    switch (user.role as UserRole) {
      case "admin":
        return "bg-gradient-to-br from-purple-400 to-purple-600 text-white";
      case "partner":
        return "bg-gradient-to-br from-blue-400 to-blue-600 text-white";
      case "doctor":
        return "bg-gradient-to-br from-green-400 to-green-600 text-white";
      case "patient":
      default:
        return "bg-gradient-to-br from-primary-400 to-primary-600 text-white";
    }
  };
  
  // Obtém as cores do plano do usuário
  const planColors = getPlanColor(user.subscriptionPlan || undefined);
  
  if (compact) {
    return (
      <Button variant="ghost" size="icon" className="ml-2 rounded-full glass-card-subtle hover:bg-white/50 p-0 h-9 w-9 transition-all duration-300">
        <div className="relative h-full w-full">
          {user.subscriptionPlan && user.subscriptionPlan !== "free" && (
            <div className={`absolute -inset-0.5 rounded-full bg-gradient-to-r ${planColors.gradient} opacity-90 blur-[1px]`}></div>
          )}
          <Avatar className={`relative h-full w-full ${user.subscriptionPlan && user.subscriptionPlan !== "free" ? "" : "ring-2 ring-white/40"} shadow-sm`}>
            {user.profileImage ? (
              <AvatarImage src={user.profileImage} alt={user.fullName || "Avatar"} />
            ) : (
              <AvatarFallback className={`${getAvatarGradient()} text-sm font-medium`}>
                {getUserInitials()}
              </AvatarFallback>
            )}
          </Avatar>
          {user.subscriptionPlan && user.subscriptionPlan !== "free" && (
            <div className="absolute -bottom-1 -right-1">
              <PlanIndicator plan={user.subscriptionPlan} variant="icon" size="sm" />
            </div>
          )}
        </div>
      </Button>
    );
  }

  return (
    <div className="flex items-center p-2 rounded-lg hover:bg-white/30 transition-all duration-200">
      <div className="flex-shrink-0 relative">
        {user.subscriptionPlan && user.subscriptionPlan !== "free" && (
          <div className={`absolute -inset-1 rounded-full bg-gradient-to-r ${planColors.gradient} opacity-80 blur-[1px]`}></div>
        )}
        <Avatar className={`relative h-10 w-10 ${user.subscriptionPlan && user.subscriptionPlan !== "free" ? "" : "ring-2 ring-white/30"} shadow-md`}>
          {user.profileImage ? (
            <AvatarImage src={user.profileImage} alt={user.fullName || "Avatar"} />
          ) : (
            <AvatarFallback className={`${getAvatarGradient()} text-sm font-medium`}>
              {getUserInitials()}
            </AvatarFallback>
          )}
        </Avatar>
        {user.subscriptionPlan && user.subscriptionPlan !== "free" && (
          <div className="absolute -bottom-1 -right-1">
            <PlanIndicator plan={user.subscriptionPlan} variant="icon" size="sm" />
          </div>
        )}
      </div>
      <div className="ml-3 flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{user.fullName || user.username}</p>
        <div className="flex items-center mt-0.5 gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full backdrop-blur-sm ${getRoleBadgeColor()}`}>
            {getRoleLabel()}
          </span>
          {user.subscriptionPlan && user.role !== "doctor" && (
            <PlanIndicator plan={user.subscriptionPlan} variant="badge" size="sm" />
          )}
        </div>
      </div>
      <button 
        className="ml-2 p-1.5 text-gray-500 hover:text-primary rounded-full hover:bg-white/50 transition-all duration-200"
        onClick={handleLogout}
        title="Sair"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
};

export default UserProfile;
