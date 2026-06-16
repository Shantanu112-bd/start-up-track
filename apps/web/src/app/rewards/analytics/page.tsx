"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ChartCard, LineChart, PieChart } from "@cryptopay/ui";

export default function ConsumerAnalyticsPage() {
  // We use mock data here because consumer analytics isn't a dedicated backend endpoint yet,
  // but it demonstrates the capability as outlined in the plan.
  const starEarningsData = [
    { month: "Jan", earned: 450 },
    { month: "Feb", earned: 820 },
    { month: "Mar", earned: 610 },
    { month: "Apr", earned: 1200 },
    { month: "May", earned: 1550 },
    { month: "Jun", earned: 2100 },
  ];

  const sourceData = [
    { name: "Payments", value: 4500 },
    { name: "Referrals", value: 1500 },
    { name: "Campaigns", value: 800 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 border-b border-white/10 pb-6">
        <Link href="/rewards" className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Reward Analytics</h1>
          <p className="text-muted-foreground mt-1 text-sm">Visualize your STAR earning trends.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard 
          title="Earnings Over Time" 
          description="STAR tokens earned per month"
        >
          <LineChart 
            data={starEarningsData} 
            index="month" 
            categories={["earned"]} 
            colors={["#f59e0b"]}
            valueFormatter={(val) => `${val} STAR`}
          />
        </ChartCard>

        <ChartCard 
          title="Earning Sources" 
          description="Where your STAR tokens come from"
        >
          <PieChart 
            data={sourceData} 
            nameKey="name" 
            dataKey="value" 
            colors={["#3b82f6", "#10b981", "#8b5cf6"]}
            valueFormatter={(val) => `${val} STAR`}
          />
        </ChartCard>
      </div>
    </div>
  );
}
