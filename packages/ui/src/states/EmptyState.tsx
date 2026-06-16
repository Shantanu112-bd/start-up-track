import * as React from "react";
import { cn } from "../lib/utils";
import { FileQuestion } from "lucide-react";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ 
  icon = <FileQuestion className="h-10 w-10 text-muted-foreground/50" />, 
  title, 
  description, 
  action, 
  className, 
  ...props 
}: EmptyStateProps) {
  return (
    <div 
      className={cn("flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-xl bg-muted/10", className)} 
      {...props}
    >
      <div className="mb-4 bg-muted/20 p-4 rounded-full">
        {icon}
      </div>
      <h3 className="text-lg font-semibold tracking-tight mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
