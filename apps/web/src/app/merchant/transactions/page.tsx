"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cryptoPaySdk } from "@cryptopay/sdk";
import { 
  Skeleton,
  TransactionCard,
  Badge
} from "@cryptopay/ui";
import { Search, Download, Filter } from "lucide-react";

const DEMO_MERCHANT_ID = "11111111-1111-1111-1111-111111111111";

export default function MerchantTransactionsPage() {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["merchant-transactions-all", DEMO_MERCHANT_ID],
    queryFn: () => cryptoPaySdk.merchants.getMerchantTransactions(DEMO_MERCHANT_ID, { limit: 20 }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Transactions</h1>
          <p className="text-muted-foreground mt-1 text-sm">View and manage all customer payments and settlements.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-white/10 bg-black hover:bg-white/5 h-9 px-4 py-2 text-white">
            <Filter className="mr-2 h-4 w-4" /> Filter
          </button>
          <button className="flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-white/10 bg-black hover:bg-white/5 h-9 px-4 py-2 text-white">
            <Download className="mr-2 h-4 w-4" /> Export
          </button>
        </div>
      </div>

      <div className="bg-[#111111] rounded-xl border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by ID, Status, or Asset..." 
              className="w-full bg-black border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="hidden sm:flex items-center gap-2 ml-auto">
            <Badge variant="secondary">All</Badge>
            <Badge variant="outline" className="opacity-50 hover:opacity-100 cursor-pointer">Settled</Badge>
            <Badge variant="outline" className="opacity-50 hover:opacity-100 cursor-pointer">Pending</Badge>
          </div>
        </div>

        <div className="p-0">
          <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/10 bg-black/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="col-span-5">Transaction</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3 text-right">Date</div>
          </div>
          
          <div className="divide-y divide-white/5">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="p-4"><Skeleton className="h-16 w-full rounded-lg" /></div>
              ))
            ) : transactions?.data.length === 0 ? (
              <div className="text-center p-12 text-muted-foreground">
                No transactions found
              </div>
            ) : (
              transactions?.data.map((tx) => (
                <div key={tx.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                  <TransactionCard transaction={tx} isOutbound={false} className="border-0 bg-transparent p-0 shadow-none hover:bg-transparent" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
