"use client";

import { Buffer } from "buffer";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import freighterApi from "@stellar/freighter-api";
const { isConnected, requestAccess, getAddress } = freighterApi;
import { getWalletBalances } from "@/lib/horizon";
import { getStarBalanceFromContract } from "@/lib/stellar";
import { useAppStore } from "@/lib/store";
import { cryptoPaySdk } from "@cryptopay/sdk";

interface StellarWalletContextType {
  publicKey: string | null;
  isWalletInstalled: boolean;
  isConnecting: boolean;
  balances: { XLM: string; USDC: string; STAR: string };
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalances: () => Promise<void>;
}

const StellarWalletContext = createContext<StellarWalletContextType | undefined>(undefined);

export function StellarWalletProvider({ children }: { children: React.ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isWalletInstalled, setIsWalletInstalled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balances, setBalances] = useState({ XLM: "0.00", USDC: "0.00", STAR: "0.00" });

  useEffect(() => {
    // Check if Freighter is installed
    const checkFreighter = async () => {
      if (await isConnected()) {
        setIsWalletInstalled(true);
      }
    };
    checkFreighter();
  }, []);

  const refreshBalances = useCallback(async (addressToRefresh?: string) => {
    const targetAddress = addressToRefresh || publicKey;
    if (!targetAddress) return;
    
    try {
      const b = await getWalletBalances(targetAddress);
      const starBal = await getStarBalanceFromContract(targetAddress);
      setBalances({
        XLM: b.xlm,
        USDC: b.usdc,
        STAR: starBal,
      });
    } catch (error) {
      console.error("Failed to fetch balances", error);
    }
  }, [publicKey]);

  useEffect(() => {
    if (publicKey) {
      refreshBalances();
    } else {
      setBalances({ XLM: "0.00", USDC: "0.00", STAR: "0.00" });
    }
  }, [publicKey, refreshBalances]);

  const { currentUserId, isDemoMode } = useAppStore();

  const connect = async () => {
    setIsConnecting(true);
    try {
      if (!isWalletInstalled) {
        throw new Error("Freighter wallet is not installed. Please install Freighter extension.");
      }
      
      const access = await requestAccess();
      if (!access) {
        throw new Error("Access denied by user");
      }

      const result = await getAddress();
      if (!result || result.error || !result.address) {
        throw new Error(result?.error || "Failed to get wallet address");
      }
      
      const address = result.address;

      // Step 1: Get challenge from backend
      const challenge = await cryptoPaySdk.auth.walletChallenge({
        address,
        network: 'STELLAR',
        provider: 'FREIGHTER',
      });

      // Step 2: Sign the challenge message with Freighter
      const signResult = await freighterApi.signMessage(challenge.message, {
        address,
      });

      let signatureBase64 = "";
      if (typeof signResult.signedMessage === "string") {
        signatureBase64 = signResult.signedMessage;
      } else if (signResult.signedMessage) {
        signatureBase64 = Buffer.from(signResult.signedMessage).toString("base64");
      }

      // Step 3: Submit signed challenge to backend, get real JWT
      const loginResult = await cryptoPaySdk.auth.walletLogin({
        address,
        network: 'STELLAR',
        provider: 'FREIGHTER',
        nonce: challenge.nonce,
        signature: signatureBase64,
      });

      // Step 4: Store real tokens
      useAppStore.getState().setTokens(
        loginResult.auth.accessToken,
        loginResult.auth.refreshToken
      );
      useAppStore.getState().setCurrentUser(loginResult.user.id, loginResult.user.displayName);

      setPublicKey(address);
      await refreshBalances(address);
    } catch (e: any) {
      console.error("Wallet connection failed", e);
      alert(e.message || "Failed to connect to Freighter wallet.");
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
