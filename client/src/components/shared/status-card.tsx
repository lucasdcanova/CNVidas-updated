import React from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { getPlanColor } from "./plan-indicator";
import { useLocation } from "wouter";

interface StatusCardProps {
  icon: string;
  iconBgColor: string;
  iconColor: string;
  title: string;
  value: string;
  status?: {
    label: string;
    color: string;
  };
  footer?: string;
  linkText?: string;
  linkUrl?: string;
  planType?: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  icon,
  iconBgColor,
  iconColor,
  title,
  value,
  status,
  footer,
  linkText,
  linkUrl,
  planType,
}) => {
  // Usa diretamente o estilo de gradiente fornecido ou cria um baseado em cores
  const getIconStyle = () => {
    // Se já é um gradiente, retorna diretamente
    if (iconBgColor.startsWith('bg-gradient-')) {
      return iconBgColor;
    }
    
    // Caso contrário usa o switch para mapear cores básicas para gradientes
    switch (iconBgColor) {
      case "bg-primary-100":
        return "bg-gradient-to-br from-primary-400/90 to-primary-600/90";
      case "bg-secondary-100":
        return "bg-gradient-to-br from-secondary-400/90 to-secondary-600/90";
      case "bg-blue-100":
        return "bg-gradient-to-br from-blue-400/90 to-blue-600/90";
      case "bg-green-100":
        return "bg-gradient-to-br from-green-400/90 to-green-600/90";
      case "bg-purple-100":
        return "bg-gradient-to-br from-purple-400/90 to-purple-600/90";
      case "bg-red-100":
        return "bg-gradient-to-br from-red-400/90 to-red-600/90";
      case "bg-yellow-100":
        return "bg-gradient-to-br from-yellow-400/90 to-yellow-600/90";
      case "bg-gray-100":
        return "bg-gradient-to-br from-gray-400/90 to-gray-600/90";
      default:
        return `${iconBgColor}`;
    }
  };

  const getStatusStyle = () => {
    if (!status) return "";
    
    if (status.color === "bg-green-100 text-green-800") {
      return "bg-gradient-to-r from-green-500/20 to-green-700/20 text-green-700 border border-green-300/30 backdrop-blur-sm";
    } else if (status.color === "bg-yellow-100 text-yellow-800") {
      return "bg-gradient-to-r from-yellow-500/20 to-yellow-700/20 text-yellow-700 border border-yellow-300/30 backdrop-blur-sm";
    } else if (status.color === "bg-blue-100 text-blue-800") {
      return "bg-gradient-to-r from-blue-500/20 to-blue-700/20 text-blue-700 border border-blue-300/30 backdrop-blur-sm";
    } else if (status.color === "bg-red-100 text-red-800") {
      return "bg-gradient-to-r from-red-500/20 to-red-700/20 text-red-700 border border-red-300/30 backdrop-blur-sm";
    }
    
    return status.color;
  };

  const [, setLocation] = useLocation();
  
  const handleClick = () => {
    if (linkUrl) {
      setLocation(linkUrl);
    }
  };

  // Obtém as cores personalizadas para o tipo de plano
  const getPlanColors = () => {
    if (!planType || planType === 'free') return null;
    
    return getPlanColor(planType);
  };
  
  const planColors = getPlanColors();
  
  return (
    <Card className={`overflow-hidden transition-all duration-200 hover:shadow-md h-full flex flex-col ${
      planColors ? `border-[1.5px] ${planColors.border}` : ""
    }`}>
      <CardContent className="p-5">
        <div className="flex items-center">
          <div className={`flex-shrink-0 ${getIconStyle()} rounded-xl shadow-md p-3.5 ring-2 ring-white/30 flex items-center justify-center`}>
            <span className="material-icons text-white">{icon}</span>
          </div>
          <div className="ml-4 w-0 flex-1">
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <div className="flex items-center mt-1">
              <div className={`text-xl font-bold ${planColors ? planColors.text : "text-gray-800"}`}>{value}</div>
              {status && (
                <div className="ml-2 flex-shrink-0">
                  <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusStyle()}`}>
                    {status.label}
                  </span>
                </div>
              )}
            </div>
            {footer && (
              <div className="mt-2 text-sm text-gray-600">{footer}</div>
            )}
          </div>
        </div>
      </CardContent>
      {linkText && linkUrl && (
        <CardFooter 
          className={`mt-auto border-t border-gray-100/20 px-5 py-3 cursor-pointer hover:bg-white/20 transition-colors ${
            planColors ? `bg-gradient-to-r ${planColors.light}` : ""
          }`}
          onClick={handleClick}
        >
          <div className={`text-sm font-medium flex items-center ${
            planColors ? planColors.text : "text-primary hover:text-primary/80"
          }`}>
            {linkText}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default StatusCard;
