"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cryptoPaySdk } from "@cryptopay/sdk";
import { CampaignCard, Skeleton } from "@cryptopay/ui";
import { ArrowLeft, Megaphone } from "lucide-react";
import Link from "next/link";

export default function ConsumerCampaignsPage() {
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => cryptoPaySdk.campaigns.listCampaigns(),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 border-b border-white/10 pb-6">
        <Link href="/rewards" className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Active Campaigns</h1>
          <p className="text-muted-foreground mt-1 text-sm">Shop at these merchants to earn bonus STAR rewards.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)
        ) : campaigns?.data.length === 0 ? (
          <div className="col-span-full text-center p-12 bg-[#111111] rounded-xl border border-white/10">
            <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white mb-1">No active campaigns</h3>
            <p className="text-muted-foreground">Check back later for new promotional offers.</p>
          </div>
        ) : (
          campaigns?.data.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))
        )}
      </div>
    </div>
  );
}
