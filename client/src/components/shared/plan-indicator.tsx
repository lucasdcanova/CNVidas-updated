import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SubscriptionPlan } from "@/shared/types";

interface PlanIndicatorProps {
  plan?: SubscriptionPlan;
  variant?: "badge" | "border" | "icon" | "text";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const getPlanColor = (plan?: SubscriptionPlan) => {
  switch (plan) {
    case "ultra":
    case "ultra_family":
      return {
        text: "text-violet-700",
        bg: "bg-violet-100",
        border: "border-violet-300",
        gradient: "from-violet-400 to-purple-600",
        light: "bg-violet-50",
        ring: "ring-violet-300"
      };
    case "premium":
    case "premium_family":
      return {
        text: "text-amber-700",
        bg: "bg-amber-100",
        border: "border-amber-300",
        gradient: "from-amber-400 to-orange-500",
        light: "bg-amber-50",
        ring: "ring-amber-300"
      };
    case "basic":
    case "basic_family":
      return {
        text: "text-emerald-700",
        bg: "bg-emerald-100",
        border: "border-emerald-300",
        gradient: "from-emerald-400 to-teal-500",
        light: "bg-emerald-50",
        ring: "ring-emerald-300"
      };
    case "free":
    default:
      return {
        text: "text-gray-700",
        bg: "bg-gray-100",
        border: "border-gray-300",
        gradient: "from-gray-400 to-gray-500",
        light: "bg-gray-50",
        ring: "ring-gray-300"
      };
  }
};

export const getPlanName = (plan?: SubscriptionPlan): string => {
  switch (plan) {
    case "ultra":
      return "Ultra";
    case "ultra_family":
      return "Ultra Família";
    case "premium":
      return "Premium";
    case "premium_family":
      return "Premium Família";
    case "basic":
      return "Básico";
    case "basic_family":
      return "Básico Família";
    case "free":
    default:
      return "Gratuito";
  }
};

export const PlanIndicator: React.FC<PlanIndicatorProps> = ({ 
  plan, 
  variant = "badge",
  size = "md", 
  className
}) => {
  const colors = getPlanColor(plan);
  const planName = getPlanName(plan);
  
  if (variant === "badge") {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "font-medium border rounded-full px-2 py-0.5",
          colors.bg,
          colors.text,
          colors.border,
          size === "sm" ? "text-xs" : size === "lg" ? "text-sm px-3 py-1" : "text-xs",
          className
        )}
      >
        {planName}
      </Badge>
    );
  }
  
  if (variant === "border") {
    return (
      <div 
        className={cn(
          "rounded-full overflow-hidden",
          colors.ring,
          size === "sm" ? "ring-1" : size === "lg" ? "ring-4" : "ring-2",
          className
        )}
      />
    );
  }
  
  if (variant === "icon") {
    return (
      <div 
        className={cn(
          "rounded-full flex items-center justify-center",
          colors.bg,
          colors.text,
          size === "sm" ? "w-4 h-4 text-xs" : 
          size === "lg" ? "w-6 h-6 text-sm" : "w-5 h-5 text-xs",
          className
        )}
      >
        {plan && plan !== "free" ? "★" : "○"}
      </div>
    );
  }
  
  return (
    <span 
      className={cn(
        colors.text,
        "font-medium",
        size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm",
        className
      )}
    >
      {planName}
    </span>
  );
};

export default PlanIndicator;