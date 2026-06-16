import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

interface LoadingSpinnerProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export function LoadingSpinner({ className, size = 24, ...props }: LoadingSpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin text-muted-foreground", className)}
      size={size}
      {...props}
    />
  );
}
