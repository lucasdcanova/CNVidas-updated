import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
  headers?: string[];
  mobileCardRenderer?: (row: any, index: number) => React.ReactNode;
}

interface ResponsiveTableRowProps {
  children: React.ReactNode;
  className?: string;
  data?: Record<string, any>;
}

interface ResponsiveTableCellProps {
  children: React.ReactNode;
  className?: string;
  header?: string;
  hideOnMobile?: boolean;
  colSpan?: number;
}

const ResponsiveTable = ({ children, className, ...props }: ResponsiveTableProps) => {
  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block w-full">
        <div className="overflow-x-auto border rounded-md">
          <table className={cn("w-full caption-bottom text-sm min-w-max", className)} style={{ minWidth: '800px' }}>
            {children}
          </table>
        </div>
      </div>
      
      {/* Mobile Cards */}
      <div className="md:hidden space-y-3 p-4">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child) && child.type === ResponsiveTableBody) {
            return React.cloneElement(child as React.ReactElement<any>, { 
              isMobile: true 
            });
          }
          return null;
        })}
      </div>
    </>
  );
};

const ResponsiveTableHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <thead className={cn("[&_tr]:border-b bg-muted/50", className)}>
      {children}
    </thead>
  );
};

const ResponsiveTableBody = ({ 
  children, 
  className, 
  isMobile = false 
}: { 
  children: React.ReactNode; 
  className?: string; 
  isMobile?: boolean;
}) => {
  if (isMobile) {
    return (
      <>
        {React.Children.map(children, (child, index) => {
          if (React.isValidElement(child) && child.type === ResponsiveTableRow) {
            return React.cloneElement(child as React.ReactElement<any>, { 
              isMobile: true,
              index 
            });
          }
          return null;
        })}
      </>
    );
  }

  return (
    <tbody className={cn("[&_tr:last-child]:border-0", className)}>
      {children}
    </tbody>
  );
};

const ResponsiveTableRow = ({ 
  children, 
  className, 
  data, 
  isMobile = false, 
  index 
}: ResponsiveTableRowProps & { isMobile?: boolean; index?: number }) => {
  if (isMobile) {
    return (
      <Card className="p-0 w-full">
        <CardContent className="p-4">
          <div className="space-y-3">
            {React.Children.map(children, (child, cellIndex) => {
              if (React.isValidElement(child) && child.type === ResponsiveTableCell) {
                return React.cloneElement(child as React.ReactElement<any>, { 
                  isMobile: true,
                  key: cellIndex 
                });
              }
              return null;
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <tr className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)}>
      {children}
    </tr>
  );
};

const ResponsiveTableHead = ({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string;
}) => {
  return (
    <th className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap",
      className
    )}>
      {children}
    </th>
  );
};

const ResponsiveTableCell = ({ 
  children, 
  className, 
  header, 
  hideOnMobile = false,
  colSpan,
  isMobile = false
}: ResponsiveTableCellProps & { isMobile?: boolean }) => {
  if (isMobile) {
    if (hideOnMobile) return null;
    
    // Se for uma célula especial (sem header), renderizar diretamente
    if (!header) {
      return <div className={cn("w-full", className)}>{children}</div>;
    }
    
    return (
      <div className="flex justify-between items-start py-1 gap-2">
        <span className="text-sm font-medium text-muted-foreground min-w-0 flex-shrink-0">
          {header}:
        </span>
        <div className="text-sm text-right flex-1 min-w-0">
          {children}
        </div>
      </div>
    );
  }

  return (
    <td className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} colSpan={colSpan}>
      {children}
    </td>
  );
};

const ResponsiveTableCaption = ({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string;
}) => {
  return (
    <caption className={cn("mt-4 text-sm text-muted-foreground", className)}>
      {children}
    </caption>
  );
};

export {
  ResponsiveTable,
  ResponsiveTableHeader,
  ResponsiveTableBody,
  ResponsiveTableHead,
  ResponsiveTableRow,
  ResponsiveTableCell,
  ResponsiveTableCaption,
}; 