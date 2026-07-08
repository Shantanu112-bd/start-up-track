"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cryptoPaySdk } from "@cryptopay/sdk";
import { MetricCard, ChartCard, Skeleton, Button } from "@cryptopay/ui";
import { DollarSign, Users, TrendingUp, BarChart3, Star, ArrowUp } from "lucide-react";
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

export default function AnalyticsPage() {
  const [period, setPeriod] = React.useState("30d");
  const { merchantId, isLoading: merchantLoading } = useMerchant();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["merchant-analytics", merchantId, period],
    queryFn: () => cryptoPaySdk.analytics.getDashboardMetrics(merchantId!),
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
          <SectionTag label="ANALYTICS" />
          <h1 className="text-3xl font-bold tracking-tight font-[family-name:var(--font-ibm-plex-mono)] text-ink">Merchant Analytics</h1>
        </div>
        <div className="pill-tabs">
          {["7d", "30d", "90d", "1Y"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`pill-tab ${period === p ? "pill-tab-active" : ""}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-card stats-card-4">
        <div className="stat-col">
          <div className="stat-number !text-3xl">₹2.4M</div>
          <div className="stat-primary-label">Revenue</div>
          <div className="stat-sub-label flex items-center gap-1 justify-center">
            <ArrowUp className="w-3 h-3" /> 12.4%
          </div>
        </div>
        <div className="stat-col">
          <div className="stat-number !text-3xl">1,240</div>
          <div className="stat-primary-label">Transactions</div>
          <div className="stat-sub-label flex items-center gap-1 justify-center">
            <ArrowUp className="w-3 h-3" /> 8.2%
          </div>
        </div>
        <div className="stat-col">
          <div className="stat-number !text-3xl">₹1,935</div>
          <div className="stat-primary-label">Avg. Order</div>
        </div>
        <div className="stat-col">
          <div className="stat-number !text-3xl">92%</div>
          <div className="stat-primary-label">Success Rate</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="card-white">
          <h3 className="font-bold font-[family-name:var(--font-ibm-plex-mono)] text-lg mb-6">Revenue Trend</h3>
          <div className="flex items-end gap-2 h-40">
            {[40, 55, 45, 70, 60, 80, 65, 90, 75, 85, 95, 88].map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
                className="flex-1 bg-ink"
                style={{ borderRadius: 0 }}
              />
            ))}
          </div>
        </div>

        {/* Transaction Volume */}
        <div className="card-white">
          <h3 className="font-bold font-[family-name:var(--font-ibm-plex-mono)] text-lg mb-6">Transaction Volume</h3>
          <div className="flex items-end gap-2 h-40">
            {[30, 65, 50, 75, 55, 85, 70, 40, 60, 90, 80, 95].map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
                className="flex-1 bg-lime border-[1px] border-ink"
                style={{ borderRadius: 0 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* STAR Distribution */}
      <div className="space-y-4">
        <SectionTag label="STAR DISTRIBUTION" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <MetricCard
            title="Total STAR Issued"
            value="25,000"
            icon={<Star className="w-4 h-4" />}
            trend={{ value: 15, label: "vs last month", isPositive: true }}
          />
          <MetricCard
            title="STAR per Transaction"
            value="20.2"
            icon={<BarChart3 className="w-4 h-4" />}
            trend={{ value: 3.1, label: "avg", isPositive: true }}
          />
          <MetricCard
            title="Unique Earners"
            value="840"
            icon={<Users className="w-4 h-4" />}
            trend={{ value: 22, label: "new this month", isPositive: true }}
          />
        </div>
      </div>

      {/* Performance */}
      <div className="card-white">
        <h3 className="font-bold font-[family-name:var(--font-ibm-plex-mono)] text-lg mb-6">Settlement Performance</h3>
        <div className="space-y-4">
          {[
            { label: "Completed", pct: 92, color: "bg-ink" },
            { label: "Pending", pct: 5, color: "bg-muted" },
            { label: "Failed", pct: 3, color: "bg-border-light" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-4">
              <span className="text-sm font-[family-name:var(--font-ibm-plex-mono)] w-24">{item.label}</span>
              <div className="flex-1 progress-bar-track">
                <motion.div 
                  className={`progress-bar-fill ${item.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.pct}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
              </div>
              <span className="text-sm font-[family-name:var(--font-ibm-plex-mono)] font-bold w-10 text-right">{item.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
