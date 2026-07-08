"use client";

import * as React from "react";
import { ArrowLeft, Coins, Calendar, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cryptoPaySdk } from "@cryptopay/sdk";

import { useMerchant } from "../../../../hooks/useMerchant";
import { Skeleton } from "@cryptopay/ui";

function MerchantLoadingSkeleton() {
  return (
    <div className="space-y-4 p-8">
      <Skeleton className="h-24 w-full rounded-[12px]" />
      <Skeleton className="h-24 w-full rounded-[12px]" />
      <Skeleton className="h-24 w-full rounded-[12px]" />
      <Skeleton className="h-24 w-full rounded-[12px]" />
    </div>
  );
}

const DEMO_BRAND_ID = "22222222-2222-2222-2222-222222222222"; // In a real app we'd fetch this

export default function CreateCampaignPage() {
  const router = useRouter();
  const { merchantId, isLoading: merchantLoading } = useMerchant();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    budget: "",
    rewardRate: "",
    type: "SPEND_AND_EARN",
    targetAmount: "",
    startsAt: "",
    endsAt: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await cryptoPaySdk.campaigns.createCampaign({
        name: formData.name,
        brandId: DEMO_BRAND_ID,
        budgetUsdc: parseFloat(formData.budget),
        rewardMultiplier: parseFloat(formData.rewardRate),
        rewardType: formData.type,
        thresholdAmountPaise: formData.targetAmount ? (parseFloat(formData.targetAmount) * 100).toString() : "0",
        startsAt: formData.startsAt ? new Date(formData.startsAt).toISOString() : undefined,
        endsAt: formData.endsAt ? new Date(formData.endsAt).toISOString() : undefined,
      });
      // Redirect back to campaigns list after creation
      router.push("/merchant/campaigns");
    } catch (error) {
      console.error("Failed to create campaign", error);
      alert("Error creating campaign. Check console.");
    } finally {
      setLoading(false);
    }
  };

  if (merchantLoading) return <MerchantLoadingSkeleton />;
  if (!merchantId) return (
    <div className="p-8 text-center">
      <p className="font-mono text-sm text-muted">
        No merchant account found.
      </p>
      <p className="font-mono text-xs text-muted mt-2">
        Contact support to set up your merchant profile.
      </p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 border-b border-white/10 pb-6">
        <Link href="/merchant/campaigns" className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Create Campaign</h1>
          <p className="text-muted-foreground mt-1 text-sm">Fund a new STAR rewards campaign to attract users.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#111111] rounded-xl border border-white/10 p-6 space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-white mb-2">Campaign Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Summer Coffee Special"
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-white mb-2">Campaign Type</label>
              <select
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="SPEND_AND_EARN">Spend & Earn</option>
                <option value="WELCOME_BONUS">Welcome Bonus</option>
                <option value="DOUBLE_REWARDS">Double Rewards</option>
                <option value="REFERRAL_CAMPAIGN">Referral Campaign</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Total Budget (USDC)</label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="number"
                  required
                  min="10"
                  step="1"
                  placeholder="500"
                  className="w-full bg-black border border-white/10 rounded-lg pl-9 pr-4 py-2 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Target Transaction Amount (INR)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  className="w-full bg-black border border-white/10 rounded-lg pl-9 pr-4 py-2 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Reward Multiplier</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">x</span>
                <input
                  type="number"
                  required
                  min="0.1"
                  step="0.1"
                  placeholder="1.5"
                  className="w-full bg-black border border-white/10 rounded-lg pl-9 pr-4 py-2 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={formData.rewardRate}
                  onChange={(e) => setFormData({ ...formData, rewardRate: e.target.value })}
                />
              </div>
            </div>
            
            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Start Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="date"
                    className="w-full bg-black border border-white/10 rounded-lg pl-9 pr-4 py-2 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={formData.startsAt}
                    onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">End Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="date"
                    className="w-full bg-black border border-white/10 rounded-lg pl-9 pr-4 py-2 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={formData.endsAt}
                    onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-4 text-sm text-blue-200">
          <p>By creating this campaign, {formData.budget || "0"} USDC will be locked in the smart contract to fund the STAR rewards pool.</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          {loading ? "Creating..." : "Fund Campaign"}
        </button>
      </form>
    </div>
  );
}
