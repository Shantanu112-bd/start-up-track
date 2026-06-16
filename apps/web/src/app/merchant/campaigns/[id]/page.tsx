"use client";

import * as React from "react";
import { ArrowLeft, Play, Pause, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cryptoPaySdk } from "@cryptopay/sdk";
import { Skeleton, MetricCard, ChartCard, LineChart } from "@cryptopay/ui";

export default function CampaignDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => cryptoPaySdk.campaigns.getCampaign(id),
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["campaign-analytics", id],
    queryFn: () => cryptoPaySdk.campaigns.getCampaignAnalytics(id),
  });

  // Mock timeline data for the chart since the backend might not return time series
  const timelineData = [
    { day: "Day 1", distributed: 120 },
    { day: "Day 2", distributed: 350 },
    { day: "Day 3", distributed: 410 },
    { day: "Day 4", distributed: 800 },
    { day: "Day 5", distributed: 1150 },
  ];

  if (campaignLoading) {
    return (
      <div className="space-y-6 animate-in fade-in max-w-5xl mx-auto">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return <div className="text-white">Campaign not found</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <Link href="/merchant/campaigns" className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white">{campaign.name}</h1>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                {campaign.status}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">Reward Multiplier: {campaign.rewardMultiplier}x</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {campaign.status === "ACTIVE" ? (
            <button className="flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 h-9 px-4 py-2">
              <Pause className="mr-2 h-4 w-4" /> Pause Campaign
            </button>
          ) : (
            <button className="flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-emerald-600 hover:bg-emerald-700 text-white shadow h-9 px-4 py-2">
              <Play className="mr-2 h-4 w-4" /> Activate
            </button>
          )}
          <button className="flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-white/10 bg-black hover:bg-white/5 text-white h-9 px-4 py-2">
            <CheckCircle className="mr-2 h-4 w-4" /> Mark Complete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <MetricCard 
          title="Total Budget" 
          value={`${campaign.budgetUsdc.toString()} USDC`} 
        />
        <MetricCard 
          title="STAR Distributed" 
          value={`${analytics?.totalDistributedSTAR || 0} STAR`} 
        />
        <MetricCard 
          title="Participants" 
          value={(analytics?.participantCount || 0).toString()} 
        />
      </div>

      <ChartCard 
        title="Distribution Timeline" 
        description="STAR tokens distributed per day over the campaign lifecycle"
      >
        {analyticsLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <LineChart 
            data={timelineData} 
            index="day" 
            categories={["distributed"]} 
            colors={["#10b981"]}
            valueFormatter={(val) => `${val} STAR`}
          />
        )}
      </ChartCard>
    </div>
  );
}
