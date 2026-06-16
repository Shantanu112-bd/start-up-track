"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, QrCode, History, Gift, User, LogOut } from "lucide-react";
import { cn } from "@cryptopay/ui";

const consumerNavItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Wallet", href: "/wallet", icon: Wallet },
  { name: "Scan & Pay", href: "/pay", icon: QrCode },
  { name: "History", href: "/history", icon: History },
  { name: "Rewards", href: "/rewards", icon: Gift },
  { name: "Profile", href: "/profile", icon: User },
];

const merchantNavItems = [
  { name: "Overview", href: "/merchant", icon: LayoutDashboard },
  { name: "Transactions", href: "/merchant/transactions", icon: History },
  { name: "Campaigns", href: "/merchant/campaigns", icon: Gift },
  { name: "Analytics", href: "/merchant/analytics", icon: Wallet }, // You could use BarChart icon here if available
];

export function Sidebar() {
  const pathname = usePathname();
  const isMerchant = pathname.startsWith("/merchant");
  const navItems = isMerchant ? merchantNavItems : consumerNavItems;

  return (
    <aside className="hidden lg:flex w-64 flex-col bg-black/40 border-r border-white/10 backdrop-blur-xl h-screen sticky top-0">
      <div className="p-6">
        <Link href={isMerchant ? "/merchant" : "/"} className="flex items-center gap-2">
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-200">
            CryptoPay {isMerchant && <span className="text-sm font-normal text-blue-300">for Business</span>}
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.href === "/merchant" ? pathname === "/merchant" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                isActive 
                  ? "bg-blue-600/20 text-blue-400 font-medium" 
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 mt-auto">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors">
          <LogOut className="h-5 w-5" />
          <span>Disconnect</span>
        </button>
      </div>
    </aside>
  );
}
