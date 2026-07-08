"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cryptoPaySdk } from "@cryptopay/sdk";
import { CampaignCard, Skeleton, EmptyState, Button } from "@cryptopay/ui";
import { Plus, Gift, Sparkles } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

/* ─── SECTION TAG ─── */
function SectionTag({ label }: { label: string }) {
  return (
    <div className="section-tag">
      <span className="tag-marker" />
      <span className="tag-line" />
      <span className="tag-label">{label}</span>
    </div>
  );
}

import { useMerchant } from "../../../hooks/useMerchant";

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

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = React.useState("ALL");
  const { merchantId, isLoading: merchantLoading } = useMerchant();

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns", merchantId],
    queryFn: () => cryptoPaySdk.campaigns.listCampaigns(),
    enabled: !!merchantId,
  });

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

  const tabs = ["ALL", "Active", "Scheduled", "Completed"];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <SectionTag label="CAMPAIGNS" />
          <h1 className="text-3xl font-bold tracking-tight font-[family-name:var(--font-ibm-plex-mono)] text-ink">Reward Campaigns</h1>
        </div>
        <Link href="/merchant/campaigns/create">
          <Button variant="accent">
            <Plus className="mr-2 h-4 w-4" /> New Campaign →
          </Button>
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="pill-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pill-tab ${activeTab === tab ? "pill-tab-active" : ""}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Campaign Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-[240px] w-full rounded-[20px] border-[1.5px] border-ink/10" />)}
        </div>
      ) : ((campaigns as any)?.data ?? []).length === 0 ? (
        <EmptyState 
          icon={<Sparkles className="h-8 w-8" />}
          title="No Campaigns Yet" 
          description="Create reward campaigns to incentivize payments and increase customer retention."
          action={
            <Link href="/merchant/campaigns/create">
              <Button variant="accent"><Plus className="mr-2 h-4 w-4" /> Create First Campaign →</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {((campaigns as any)?.data ?? []).map((campaign: any) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </motion.div>
  );
}
