"use client";

import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../lib/query-client";
import { initializeSdk } from "@cryptopay/sdk";
import { StellarWalletProvider } from "./StellarWalletProvider";
import { AppLock } from "../auth/AppLock";
import { KycOnboarding } from "../kyc/KycOnboarding";
import { KycPending } from "../kyc/KycPending";
import { useQuery } from "@tanstack/react-query";
import { cryptoPaySdk } from "@cryptopay/sdk";

import { useAppStore } from "../../lib/store";

// Demo User ID — kept for reference if needed
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

const getApiUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  return url.startsWith("http") ? url : `https://${url}`;
};

// Initialize SDK with getToken for JWT auth
const sdk = initializeSdk({
  baseUrl: `${getApiUrl()}/api/v1`,
  getToken: () => {
    if (typeof window === "undefined") return null;
    return useAppStore.getState().accessToken || null;
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StellarWalletProvider>
      <QueryClientProvider client={queryClient}>
        <AppLockWrapper>{children}</AppLockWrapper>
      </QueryClientProvider>
    </StellarWalletProvider>
  );
}

function AppLockWrapper({ children }: { children: React.ReactNode }) {
  const { 
    isAppUnlocked, 
    accessToken, 
    kycStatus,
    setKycStatus 
  } = useAppStore();

  // Fetch real KYC status on every authenticated load
  const { data: me } = useQuery({
    queryKey: ['me', accessToken],
    queryFn: () => cryptoPaySdk.auth.getCurrentUser(),
    enabled: !!accessToken,
  });

  React.useEffect(() => {
    if (me?.kycStatus) {
      setKycStatus(me.kycStatus);
    }
  }, [me, setKycStatus]);

  // Not logged in — show connect wallet flow
  if (!accessToken) return <>{children}</>;

  // Logged in but app locked — show biometric/PIN
  if (!isAppUnlocked) return <AppLock />;

  // Logged in, unlocked, but KYC not done
  const kycRequired = !kycStatus || 
    kycStatus === 'NOT_STARTED' || 
    kycStatus === 'REJECTED';
  const kycPending = kycStatus === 'PENDING' || 
    kycStatus === 'IN_REVIEW';

  if (kycRequired) return <KycOnboarding />;
  if (kycPending) return <KycPending />;

  // All checks passed — show app
  return <>{children}</>;
}
