"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { isConnected, requestAccess, getPublicKey } from "@stellar/freighter-api";
import { fetchBalances, BalanceMap, getStarBalanceFromContract } from "@/lib/stellar";

interface StellarWalletContextType {
  publicKey: string | null;
  isWalletInstalled: boolean;
  isConnecting: boolean;
  balances: BalanceMap;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalances: () => Promise<void>;
}

const StellarWalletContext = createContext<StellarWalletContextType | undefined>(undefined);

export function StellarWalletProvider({ children }: { children: React.ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isWalletInstalled, setIsWalletInstalled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balances, setBalances] = useState<BalanceMap>({ XLM: "0.00", USDC: "0.00", STAR: "0.00" });

  useEffect(() => {
    // Check if Freighter is installed
    const checkFreighter = async () => {
      if (await isConnected()) {
        setIsWalletInstalled(true);
      }
    };
    checkFreighter();
  }, []);

  const refreshBalances = async () => {
    if (!publicKey) return;
    try {
      const b = await fetchBalances(publicKey);
      const starBal = await getStarBalanceFromContract(publicKey);
      b.STAR = starBal;
      setBalances(b);
    } catch (error) {
      console.error("Failed to fetch balances", error);
    }
  };

  useEffect(() => {
    if (publicKey) {
      refreshBalances();
    } else {
      setBalances({ XLM: "0.00", USDC: "0.00", STAR: "0.00" });
    }
  }, [publicKey]);

  const connect = async () => {
    if (!isWalletInstalled) {
      alert("Please install Freighter wallet extension.");
      return;
    }
    
    setIsConnecting(true);
    try {
      const access = await requestAccess();
      if (access) {
        const pk = await getPublicKey();
        setPublicKey(pk);
      } else {
        console.error("User declined connection");
      }
    } catch (e) {
      console.error("Wallet connection failed", e);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setPublicKey(null);
  };

  return (
    <StellarWalletContext.Provider 
      value={{
        publicKey,
        isWalletInstalled,
        isConnecting,
        balances,
        connect,
        disconnect,
        refreshBalances
      }}
    >
      {children}
    </StellarWalletContext.Provider>
  );
}

export function useStellarWallet() {
  const context = useContext(StellarWalletContext);
  if (context === undefined) {
    throw new Error("useStellarWallet must be used within a StellarWalletProvider");
  }
  return context;
}
