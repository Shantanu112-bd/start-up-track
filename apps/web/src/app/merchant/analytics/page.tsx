"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cryptoPaySdk } from "@cryptopay/sdk";
import { 
  ChartCard,
  LineChart,
  BarChart,
  PieChart,
  Skeleton
} from "@cryptopay/ui";

const DEMO_MERCHANT_ID = "11111111-1111-1111-1111-111111111111";

export default function MerchantAnalyticsPage() {
  const { data: revenueMetrics, isLoading: revenueLoading } = useQuery({
    queryKey: ["merchant-revenue", DEMO_MERCHANT_ID],
    queryFn: () => cryptoPaySdk.analytics.getRevenueMetrics(DEMO_MERCHANT_ID),
  });

  const { data: rewardMetrics, isLoading: rewardLoading } = useQuery({
    queryKey: ["merchant-rewards", DEMO_MERCHANT_ID],
    queryFn: () => cryptoPaySdk.analytics.getRewardMetrics(DEMO_MERCHANT_ID),
  });

  // Mock data for charts if API doesn't return time-series data yet
  const revenueChartData = [
    { date: "Mon", revenue: 12500 },
    { date: "Tue", revenue: 15200 },
    { date: "Wed", revenue: 14100 },
    { date: "Thu", revenue: 18400 },
    { date: "Fri", revenue: 21000 },
    { date: "Sat", revenue: 25500 },
    { date: "Sun", revenue: 23100 },
  ];

  const transactionChartData = [
    { date: "Mon", usdc: 45, xlm: 20 },
    { date: "Tue", usdc: 52, xlm: 25 },
    { date: "Wed", usdc: 48, xlm: 22 },
    { date: "Thu", usdc: 61, xlm: 30 },
    { date: "Fri", usdc: 75, xlm: 35 },
    { date: "Sat", usdc: 85, xlm: 40 },
    { date: "Sun", usdc: 80, xlm: 38 },
  ];

  const rewardDistributionData = [
    { name: "Coffee Campaign", value: 4500 },
    { name: "Summer Promo", value: 3200 },
    { name: "Referral Bonus", value: 2100 },
    { name: "Loyalty Tier", value: 1500 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Analytics</h1>
          <p className="text-muted-foreground mt-1 text-sm">Deep dive into your sales, volume, and reward metrics.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard 
          title="Revenue Trends" 
          description="Daily total revenue across all assets (INR)"
        >
          {revenueLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <LineChart 
              data={revenueChartData} 
              index="date" 
              categories={["revenue"]} 
              colors={["#3b82f6"]}
              valueFormatter={(val) => `₹${val.toLocaleString()}`}
            />
          )}
        </ChartCard>

        <ChartCard 
          title="Transaction Volume by Asset" 
          description="Number of transactions processed per asset"
        >
          {revenueLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <BarChart 
              data={transactionChartData} 
              index="date" 
              categories={["usdc", "xlm"]} 
              colors={["#10b981", "#f59e0b"]}
            />
          )}
        </ChartCard>

        <ChartCard 
          title="Reward Distribution" 
          description="STAR rewards minted per active campaign"
        >
          {rewardLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <PieChart 
              data={rewardDistributionData} 
              nameKey="name" 
              dataKey="value" 
              valueFormatter={(val) => `${val} STAR`}
            />
          )}
        </ChartCard>

        <div className="space-y-6">
          <div className="bg-[#111111] rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold mb-4">Metric Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <span className="text-muted-foreground">Average Order Value</span>
                <span className="font-semibold text-white">₹{revenueMetrics?.averageOrderValueInr?.toLocaleString() || "850"}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <span className="text-muted-foreground">Total STAR Minted</span>
                <span className="font-semibold text-blue-400">{rewardMetrics?.totalRewardsMinted?.toLocaleString() || "11,300"} STAR</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <span className="text-muted-foreground">Most Used Asset</span>
                <span className="font-semibold text-white">USDC (68%)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Reward ROI</span>
                <span className="font-semibold text-emerald-400">+14.2%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
