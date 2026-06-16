"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cryptoPaySdk } from "@cryptopay/sdk";
import { 
  CampaignCard,
  Skeleton,
  MetricCard
} from "@cryptopay/ui";
import { Plus } from "lucide-react";

const DEMO_MERCHANT_ID = "11111111-1111-1111-1111-111111111111";

export default function MerchantCampaignsPage() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["merchant-campaign-metrics", DEMO_MERCHANT_ID],
    queryFn: () => cryptoPaySdk.analytics.getCampaignMetrics(DEMO_MERCHANT_ID),
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => cryptoPaySdk.campaigns.listCampaigns(),
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Campaigns</h1>
          <p className="text-muted-foreground mt-1 text-sm">Join STAR reward campaigns to attract new customers.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20 h-9 px-4 py-2">
            <Plus className="mr-2 h-4 w-4" /> Create Custom Campaign
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
        ) : (
          <>
            <MetricCard 
              title="Active Campaigns" 
              value={(metrics?.activeCampaigns || 0).toString()} 
            />
            <MetricCard 
              title="Total Participants" 
              value={(metrics?.totalCampaigns || 0).toString()} 
            />
            <MetricCard 
              title="STAR Budget" 
              value={`${metrics?.totalBudgetSTAR.toLocaleString("en-US") || 0} STAR`} 
            />
            <MetricCard 
              title="STAR Distributed" 
              value={`${metrics?.totalDistributedSTAR.toLocaleString("en-US") || 0} STAR`} 
            />
          </>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Available Campaigns</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {campaignsLoading ? (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)
          ) : campaigns?.data.length === 0 ? (
            <div className="col-span-full text-center p-12 text-muted-foreground bg-[#111111] rounded-xl border border-white/10">
              No active campaigns right now.
            </div>
          ) : (
            campaigns?.data.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
