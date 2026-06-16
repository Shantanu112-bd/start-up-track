"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cryptoPaySdk } from "@cryptopay/sdk";
import { TransactionCard, Skeleton, EmptyState } from "@cryptopay/ui";
import { Filter, Download } from "lucide-react";

export default function HistoryPage() {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions-all"],
    queryFn: () => cryptoPaySdk.transactions.list({ limit: 50 }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">History</h1>
          <p className="text-muted-foreground mt-1">View your transaction history and payment flows.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm hover:bg-white/10 transition-colors">
            <Filter className="h-4 w-4" /> Filter
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm hover:bg-white/10 transition-colors">
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : transactions?.data.length === 0 ? (
          <EmptyState 
            title="No Transactions Found" 
            description="You haven't made any payments yet. Scan a QR code to make your first payment." 
          />
        ) : (
          <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden divide-y divide-white/5">
            {transactions?.data.map((tx) => (
              <div key={tx.id} className="p-2">
                <TransactionCard 
                  transaction={tx} 
                  isOutbound={tx.type === "CRYPTO_TO_FIAT"} 
                  className="border-none shadow-none bg-transparent hover:bg-white/5" 
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
