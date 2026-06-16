import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { cn } from "../lib/utils";

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
}

export function MetricCard({ title, value, icon, trend, className, ...props }: MetricCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)} {...props}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground h-4 w-4">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <span className={trend.isPositive ? "text-green-500" : "text-red-500"}>
              {trend.isPositive ? "+" : ""}{trend.value}%
            </span>
            {" "}{trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
