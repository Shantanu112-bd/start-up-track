"use client";

import React from "react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
  Legend,
} from "recharts";
import { cn } from "../lib/utils";

interface PieChartProps {
  data: any[];
  nameKey: string;
  dataKey: string;
  colors?: string[];
  className?: string;
  valueFormatter?: (value: number) => string;
}

const CustomTooltip = ({ active, payload, valueFormatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/80 backdrop-blur-sm p-3 shadow-xl">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.payload.fill || entry.color }} />
            <span className="text-sm font-medium text-white/70">{entry.name}:</span>
            <span className="text-sm font-semibold text-white">
              {valueFormatter ? valueFormatter(entry.value as number) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function PieChart({
  data,
  nameKey,
  dataKey,
  colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"],
  className,
  valueFormatter,
}: PieChartProps) {
  return (
    <div className={cn("w-full h-full min-h-[300px]", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="80%"
            paddingAngle={5}
            dataKey={dataKey}
            nameKey={nameKey}
            stroke="none"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length] as string} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip {...(valueFormatter ? { valueFormatter } : {})} />} />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle"
            formatter={(value) => <span className="text-white/70 text-sm ml-1">{value}</span>}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}
