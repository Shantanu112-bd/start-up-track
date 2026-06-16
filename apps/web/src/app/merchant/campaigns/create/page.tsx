"use client";

import * as React from "react";
import { ArrowLeft, Coins, Calendar, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cryptoPaySdk } from "@cryptopay/sdk";

const DEMO_MERCHANT_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_BRAND_ID = "22222222-2222-2222-2222-222222222222"; // In a real app we'd fetch this

export default function CreateCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    budget: "",
    rewardRate: "",
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">
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
          <div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-white mb-2">Reward Rate</label>
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
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Info className="h-3 w-3" /> Multiplier applied to standard STAR earning rate.
              </p>
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
