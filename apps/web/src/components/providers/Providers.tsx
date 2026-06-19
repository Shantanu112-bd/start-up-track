"use client";

import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../lib/query-client";
import { initializeSdk } from "@cryptopay/sdk";
import { StellarWalletProvider } from "./StellarWalletProvider";

// Demo User ID — kept for reference if needed
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

// Initialize SDK with getToken for JWT auth
const sdk = initializeSdk({
  baseUrl: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1`,
  getToken: () => typeof window !== "undefined" ? localStorage.getItem("accessToken") : null,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StellarWalletProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </StellarWalletProvider>
  );
}
