import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface MobileFormWrapperProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  contentClassName?: string;
}

export const MobileFormWrapper: React.FC<MobileFormWrapperProps> = ({
  children,
  title,
  description,
  className,
  contentClassName
}) => {
  return (
    <Card className={cn("w-full", className)}>
      {(title || description) && (
        <CardHeader className="space-y-1 pb-4">
          {title && (
            <CardTitle className="text-lg lg:text-xl font-semibold">
              {title}
            </CardTitle>
          )}
          {description && (
            <CardDescription className="text-sm lg:text-base">
              {description}
            </CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent className={cn("space-y-4 lg:space-y-6", contentClassName)}>
        <div className="grid gap-3 lg:gap-4">
          {children}
        </div>
      </CardContent>
    </Card>
  );
};

interface MobileFormSectionProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export const MobileFormSection: React.FC<MobileFormSectionProps> = ({
  children,
  title,
  description,
  className
}) => {
  return (
    <div className={cn("space-y-3 lg:space-y-4", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h3 className="text-sm lg:text-base font-medium text-foreground">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-xs lg:text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="grid gap-3 lg:gap-4">
        {children}
      </div>
    </div>
  );
};

interface MobileFormGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

export const MobileFormGrid: React.FC<MobileFormGridProps> = ({
  children,
  columns = 1,
  className
}) => {
  const gridClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 lg:grid-cols-2",
    3: "grid-cols-1 lg:grid-cols-3"
  };

  return (
    <div className={cn("grid gap-3 lg:gap-4", gridClasses[columns], className)}>
      {children}
    </div>
  );
};

export default MobileFormWrapper; 