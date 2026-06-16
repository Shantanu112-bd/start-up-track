"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, QrCode, History, Gift, User } from "lucide-react";
import { cn } from "@cryptopay/ui";

const consumerNavItems = [
  { name: "Dash", href: "/dashboard", icon: LayoutDashboard },
  { name: "Wallet", href: "/wallet", icon: Wallet },
  { name: "Pay", href: "/pay", icon: QrCode },
  { name: "History", href: "/history", icon: History },
  { name: "Profile", href: "/profile", icon: User },
];

const merchantNavItems = [
  { name: "Overview", href: "/merchant", icon: LayoutDashboard },
  { name: "Txns", href: "/merchant/transactions", icon: History },
  { name: "Campaigns", href: "/merchant/campaigns", icon: Gift },
  { name: "Analytics", href: "/merchant/analytics", icon: Wallet },
];

export function MobileNav() {
  const pathname = usePathname();
  const isMerchant = pathname.startsWith("/merchant");
  const navItems = isMerchant ? merchantNavItems : consumerNavItems;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 pb-safe z-50">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = item.href === "/merchant" ? pathname === "/merchant" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200",
                isActive 
                  ? "text-blue-400" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
