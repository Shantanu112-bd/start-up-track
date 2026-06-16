"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cryptoPaySdk } from "@cryptopay/sdk";
import { Skeleton, Card } from "@cryptopay/ui";
import { ArrowLeft, Gift, Search } from "lucide-react";
import Link from "next/link";

export default function RewardHistoryPage() {
  const { data: rewards, isLoading } = useQuery({
    queryKey: ["rewards-history"],
    queryFn: () => cryptoPaySdk.rewards.listRewards({ limit: 20 }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 border-b border-white/10 pb-6">
        <Link href="/rewards" className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Reward History</h1>
          <p className="text-muted-foreground mt-1 text-sm">View all the STAR tokens you've earned.</p>
        </div>
      </div>

      <div className="bg-[#111111] rounded-xl border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search rewards..." 
              className="w-full bg-black border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="p-0">
          <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/10 bg-black/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="col-span-6">Description</div>
            <div className="col-span-3">Amount</div>
            <div className="col-span-3 text-right">Date</div>
          </div>
          
          <div className="divide-y divide-white/5">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="p-4"><Skeleton className="h-12 w-full rounded-lg" /></div>
              ))
            ) : rewards?.data.length === 0 ? (
              <div className="text-center p-12 text-muted-foreground">
                No rewards earned yet.
              </div>
            ) : (
              rewards?.data.map((reward) => (
                <div key={reward.id} className="p-4 hover:bg-white/[0.02] transition-colors flex flex-col sm:grid sm:grid-cols-12 gap-4 items-start sm:items-center">
                  <div className="col-span-6 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Gift className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{reward.reason}</p>
                      <p className="text-xs text-muted-foreground capitalize">{reward.status}</p>
                    </div>
                  </div>
                  <div className="col-span-3">
                    <span className="font-bold text-emerald-400">+{reward.amount.toString()} STAR</span>
                  </div>
                  <div className="col-span-3 sm:text-right text-xs text-muted-foreground">
                    {new Date(reward.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
