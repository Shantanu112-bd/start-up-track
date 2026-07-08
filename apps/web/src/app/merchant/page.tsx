"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cryptoPaySdk } from "@cryptopay/sdk";
import { MetricCard, TransactionCard, Skeleton, ChartCard, Button } from "@cryptopay/ui";
import { DollarSign, TrendingUp, CreditCard, Users, ArrowRight, Gift } from "lucide-react";
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

import { useMerchant } from "../../hooks/useMerchant";

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

export default function MerchantDashboardPage() {
  const { merchantId, isLoading: merchantLoading } = useMerchant();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["merchant-dashboard", merchantId],
    queryFn: () => cryptoPaySdk.analytics.getDashboardMetrics(merchantId!),
    enabled: !!merchantId,
  });

  const { data: transactions, isLoading: txLoading } = useQuery({
    queryKey: ["merchant-transactions", merchantId],
    queryFn: () => cryptoPaySdk.transactions.listTransactions({ limit: 5 }),
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
          <SectionTag label="MERCHANT" />
          <h1 className="text-3xl font-bold tracking-tight font-[family-name:var(--font-ibm-plex-mono)] text-ink">Merchant Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="border-[1.5px] border-ink rounded-[50px] px-3 py-1 text-xs font-semibold font-[family-name:var(--font-ibm-plex-mono)]">
            Chai Point — Demo
          </span>
          <Link href="/merchant/campaigns/create">
            <Button variant="accent" size="sm">
              <Gift className="mr-2 h-4 w-4" /> New Campaign →
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Card */}
      <div className="stats-card stats-card-4">
        <div className="stat-col">
          <div className="stat-number !text-3xl">₹2.4M</div>
          <div className="stat-primary-label">Revenue</div>
          <div className="stat-sub-label">this month</div>
        </div>
        <div className="stat-col">
          <div className="stat-number !text-3xl">1,240</div>
          <div className="stat-primary-label">Transactions</div>
          <div className="stat-sub-label">30-day</div>
        </div>
        <div className="stat-col">
          <div className="stat-number !text-3xl">840</div>
          <div className="stat-primary-label">Customers</div>
          <div className="stat-sub-label">active</div>
        </div>
        <div className="stat-col">
          <div className="stat-number !text-3xl">25K</div>
          <div className="stat-primary-label">STAR Issued</div>
          <div className="stat-sub-label">total</div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="card-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold font-[family-name:var(--font-ibm-plex-mono)] text-lg">Revenue</h3>
          <div className="pill-tabs">
            <button className="pill-tab pill-tab-active !py-1 !px-3 !text-[11px]">30d</button>
            <button className="pill-tab !py-1 !px-3 !text-[11px]">90d</button>
            <button className="pill-tab !py-1 !px-3 !text-[11px]">1Y</button>
          </div>
        </div>
        {/* Simple bar chart placeholder */}
        <div className="flex items-end gap-2 h-40">
          {[40, 60, 35, 80, 55, 90, 70, 45, 65, 85, 50, 75].map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="flex-1 bg-ink border-[1px] border-ink"
              style={{ borderRadius: 0 }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-3 text-[10px] text-muted font-[family-name:var(--font-ibm-plex-mono)]">
          <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
          <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTag label="TRANSACTIONS" />
          <Link href="/merchant/transactions">
            <Button variant="ghost" size="sm" className="text-muted">View All <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </Link>
        </div>
        <div className="border-[1.5px] border-ink rounded-[20px] overflow-hidden bg-white">
          {txLoading ? (
            <div className="p-4 space-y-3">
              {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-[12px]" />)}
            </div>
          ) : (
            ((transactions as any)?.items ?? []).map((tx: any) => (
              <TransactionCard key={tx.id} transaction={tx} isOutbound={false} />
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
