import React from "react";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  homeLink?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  homeLink = "/dashboard",
}) => {
  // Usar navegação programática para evitar problemas de aninhamento de links
  const handleNavigation = (href: string) => {
    window.location.href = href;
  };
  
  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        <li className="inline-flex items-center">
          <div 
            className="inline-flex items-center text-sm font-medium text-primary/70 hover:text-primary transition-colors duration-200 cursor-pointer"
            onClick={() => handleNavigation(homeLink)}
          >
            <Home className="h-4 w-4 mr-2" />
            Home
          </div>
        </li>
        
        {items.map((item, index) => (
          <li key={index}>
            <div className="flex items-center">
              <ChevronRight className="h-4 w-4 text-gray-400" />
              {item.href ? (
                <div 
                  className="ml-1 text-sm font-medium text-primary/70 hover:text-primary transition-colors duration-200 cursor-pointer md:ml-2"
                  onClick={() => handleNavigation(item.href!)}
                >
                  {item.label}
                </div>
              ) : (
                <span className="ml-1 text-sm font-medium text-gray-800 md:ml-2">
                  {item.label}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
