"use client";

import React from "react";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import { cn } from "../lib/utils";

interface LineChartProps {
  data: any[];
  index: string;
  categories: string[];
  colors?: string[];
  className?: string;
  valueFormatter?: (value: number) => string;
}

const CustomTooltip = ({ active, payload, label, valueFormatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/80 backdrop-blur-sm p-3 shadow-xl">
        <p className="text-sm font-medium text-white/70 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
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

export function LineChart({
  data,
  index,
  categories,
  colors = ["#3b82f6", "#10b981", "#f59e0b"],
  className,
  valueFormatter,
}: LineChartProps) {
  return (
    <div className={cn("w-full h-full min-h-[300px]", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis 
            dataKey={index} 
            stroke="rgba(255,255,255,0.4)" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            dy={10} 
          />
          <YAxis 
            stroke="rgba(255,255,255,0.4)" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            tickFormatter={(val) => valueFormatter ? valueFormatter(val) : `${val}`}
            dx={-10}
          />
          <Tooltip content={<CustomTooltip {...(valueFormatter ? { valueFormatter } : {})} />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
          {categories.map((category, i) => (
            <Line
              key={category}
              type="monotone"
              dataKey={category}
              stroke={colors[i % colors.length] as string}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, strokeWidth: 0, fill: (colors[i % colors.length] as string) }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
