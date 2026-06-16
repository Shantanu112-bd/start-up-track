"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cryptoPaySdk } from "@cryptopay/sdk";
import { 
  WalletCard, 
  RewardBalanceCard, 
  TransactionCard, 
  MetricCard, 
  Skeleton,
  Button
} from "@cryptopay/ui";
import { ArrowRight, Send, Plus, CreditCard, Wallet, QrCode } from "lucide-react";
import Link from "next/link";
import { useStellarWallet } from "../../components/providers/StellarWalletProvider";

export default function DashboardPage() {
  const { data: wallets, isLoading: walletsLoading } = useQuery({
    queryKey: ["wallets"],
    queryFn: () => cryptoPaySdk.wallets.list(),
  });

  const { data: rewards, isLoading: rewardsLoading } = useQuery({
    queryKey: ["rewards"],
    queryFn: () => cryptoPaySdk.rewards.getSummary(),
  });

  const { data: transactions, isLoading: txLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => cryptoPaySdk.transactions.list({ limit: 5 }),
  });

  const { publicKey, balances, isWalletInstalled, connect } = useStellarWallet();
  const primaryWallet = publicKey 
    ? { id: "freighter-1", address: publicKey, type: "FREIGHTER", isPrimary: true, name: "Freighter Wallet" } as any
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back. Here's your crypto overview.</p>
        </div>
        <div className="flex items-center gap-2">
          {!publicKey ? (
            <Button onClick={connect}>
              <Wallet className="mr-2 h-4 w-4" /> Connect Wallet
            </Button>
          ) : (
            <Button variant="outline">
              <QrCode className="mr-2 h-4 w-4" /> Scan QR
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Wallet Card */}
        <div className="lg:col-span-2">
          {!primaryWallet ? (
            <div className="h-full min-h-[240px] flex items-center justify-center border border-white/10 rounded-xl bg-[#111111] text-muted-foreground p-6 text-center">
              <div>
                <Wallet className="h-10 w-10 mx-auto mb-4 opacity-50" />
                <p>Connect your Freighter wallet to view your balance and make payments.</p>
                <Button className="mt-4" onClick={connect}>Connect Wallet</Button>
              </div>
            </div>
          ) : (
            <WalletCard 
              wallet={primaryWallet} 
              balance={balances.USDC} 
              assetCode="USDC" 
            />
          )}
        </div>

        {rewardsLoading || !rewards ? (
          <Skeleton className="h-[180px] w-full rounded-xl" />
        ) : (
          <RewardBalanceCard 
            starBalance={rewards.totalMinted} 
            onClaim={() => {}} 
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard title="Total Spent" value="45,231 INR" trend={{ value: 12, label: "this month", isPositive: true }} />
        <MetricCard title="Active Campaigns" value="3" icon={<CreditCard />} />
        <MetricCard title="Cashback Earned" value="2,400 INR" trend={{ value: 4, label: "this month", isPositive: true }} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Activity</h2>
          <Link href="/history">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
        
        <div className="grid gap-3">
          {txLoading ? (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
          ) : transactions?.data.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground bg-white/5 rounded-xl border border-white/10">
              No recent transactions
            </div>
          ) : (
            transactions?.data.map((tx) => (
              <TransactionCard key={tx.id} transaction={tx} isOutbound={tx.type === "CRYPTO_TO_FIAT"} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
