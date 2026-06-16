"use client";

import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../lib/query-client";
import { initializeSdk } from "@cryptopay/sdk";

// Initialize SDK globally for the client environment
// In a real app we'd pass dynamic auth tokens here via an interceptor
const sdk = initializeSdk({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
});

// Since the sdk is a singleton, we can just initialize it once.
// However, to satisfy auth requirements for demo, we mock an interceptor that always
// sends the hardcoded generic token if present.
sdk.admin.health().catch(() => {}); // Optional warm-up

import { StellarWalletProvider } from "./StellarWalletProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StellarWalletProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </StellarWalletProvider>
  );
}
