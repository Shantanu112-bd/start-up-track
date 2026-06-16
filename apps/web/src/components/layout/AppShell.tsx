"use client";

import * as React from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Exclude shell on root marketing page
  const isMarketing = pathname === "/";

  if (isMarketing) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-black text-white selection:bg-blue-500/30">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        <Topbar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
