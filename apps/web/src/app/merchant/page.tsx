"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cryptoPaySdk } from "@cryptopay/sdk";
import { 
  MetricCard, 
  Skeleton,
  TransactionCard
} from "@cryptopay/ui";
import { ArrowRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useAppStore } from "../../lib/store";

// We use the seeded merchant ID
const DEMO_MERCHANT_ID = "11111111-1111-1111-1111-111111111111";

export default function MerchantDashboardPage() {
  const { data: dashboardMetrics, isLoading: dashboardLoading } = useQuery({
    queryKey: ["merchant-dashboard", DEMO_MERCHANT_ID],
    queryFn: () => cryptoPaySdk.analytics.getDashboardMetrics(DEMO_MERCHANT_ID),
  });

  const { data: transactions, isLoading: txLoading } = useQuery({
    queryKey: ["merchant-transactions", DEMO_MERCHANT_ID],
    queryFn: () => cryptoPaySdk.merchants.getMerchantTransactions(DEMO_MERCHANT_ID, { limit: 5 }),
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Overview</h1>
          <p className="text-muted-foreground mt-1 text-sm">Monitor your real-time revenue and campaign performance.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/merchant/transactions" className="hidden sm:inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-white text-black shadow hover:bg-white/90 h-9 px-4 py-2">
            View Settlements
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboardLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
        ) : (
          <>
            <MetricCard 
              title="Total Volume" 
              value={`${dashboardMetrics?.totalVolumeInr.toLocaleString("en-IN") || 0} INR`} 
              trend={{ value: 12.5, label: "from last month", isPositive: true }} 
            />
            <MetricCard 
              title="Transactions" 
              value={(dashboardMetrics?.totalTransactions || 0).toString()} 
              trend={{ value: 5.2, label: "from last month", isPositive: true }} 
            />
            <MetricCard 
              title="Rewards Issued" 
              value={`${dashboardMetrics?.totalRewardsMinted.toLocaleString("en-IN") || 0} STAR`} 
              trend={{ value: 2.1, label: "from last month", isPositive: true }} 
            />
            <MetricCard 
              title="Active Campaigns" 
              value={(dashboardMetrics?.activeCampaigns || 0).toString()} 
              icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
            />
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Transactions</h2>
          <Link href="/merchant/transactions" className="text-sm text-muted-foreground hover:text-white flex items-center transition-colors">
            View All <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
        
        <div className="grid gap-3">
          {txLoading ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
          ) : transactions?.data.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground bg-[#111111] rounded-xl border border-white/10">
              No recent transactions
            </div>
          ) : (
            transactions?.data.map((tx) => (
              <TransactionCard key={tx.id} transaction={tx} isOutbound={false} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
