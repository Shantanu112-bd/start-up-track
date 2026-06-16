"use client";

import * as React from "react";
import { ArrowLeft, Copy, Users, Star, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { MetricCard } from "@cryptopay/ui";

export default function ReferralsPage() {
  const referralCode = "CRYPTO-2026-X8F";
  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`https://cryptopay.network/join?ref=${referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 border-b border-white/10 pb-6">
        <Link href="/rewards" className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Refer & Earn</h1>
          <p className="text-muted-foreground mt-1 text-sm">Earn 500 STAR tokens for every friend who makes a payment.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard title="Total Referrals" value="12" icon={<Users className="text-blue-400 h-5 w-5" />} />
        <MetricCard title="STAR Earned" value="6,000" icon={<Star className="text-amber-400 h-5 w-5" />} />
      </div>

      <div className="bg-[#111111] rounded-xl border border-white/10 p-6 md:p-8 flex flex-col items-center text-center space-y-6">
        <div className="h-16 w-16 bg-blue-600/20 rounded-full flex items-center justify-center">
          <Users className="h-8 w-8 text-blue-400" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="text-xl font-semibold text-white">Share your link</h2>
          <p className="text-muted-foreground text-sm">
            When your friends join CryptoPay using your link and make their first transaction, you both get 500 STAR.
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full max-w-md bg-black border border-white/10 rounded-lg p-2">
          <code className="flex-1 text-blue-400 text-sm overflow-hidden text-ellipsis whitespace-nowrap pl-2">
            https://cryptopay.network/join?ref={referralCode}
          </code>
          <button 
            onClick={copyToClipboard}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
          >
            {copied ? "Copied!" : <><Copy className="h-4 w-4" /> Copy</>}
          </button>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <h3 className="font-semibold text-lg text-white">Recent Referrals</h3>
        <div className="bg-[#111111] rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5">
          {[
            { user: "alex_dev", date: "Today, 10:42 AM", status: "Completed", amount: 500 },
            { user: "sarah.j", date: "Yesterday", status: "Completed", amount: 500 },
            { user: "mikewilson", date: "Jun 12, 2026", status: "Pending", amount: 0 },
          ].map((ref, i) => (
            <div key={i} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-white/5 rounded-full flex items-center justify-center text-muted-foreground">
                  {ref.user.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-white">@{ref.user}</p>
                  <p className="text-xs text-muted-foreground">{ref.date}</p>
                </div>
              </div>
              <div className="text-right">
                {ref.status === "Completed" ? (
                  <p className="font-bold text-emerald-400">+{ref.amount} STAR</p>
                ) : (
                  <p className="font-medium text-muted-foreground">Pending payment</p>
                )}
                <p className="text-xs text-muted-foreground">{ref.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
