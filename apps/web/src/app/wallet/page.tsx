"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cryptoPaySdk } from "@cryptopay/sdk";
import { WalletCard, Skeleton, Button, EmptyState } from "@cryptopay/ui";
import { useStellarWallet } from "../../components/providers/StellarWalletProvider";

export default function WalletPage() {
  const { data: wallets, isLoading } = useQuery({
    queryKey: ["wallets"],
    queryFn: () => cryptoPaySdk.wallets.list(),
  });

  const { publicKey, balances, isWalletInstalled, connect } = useStellarWallet();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Wallets</h1>
          <p className="text-muted-foreground mt-1">Manage your connected wallets and assets.</p>
        </div>
        <Button onClick={!publicKey ? connect : () => {}}>
          <Plus className="mr-2 h-4 w-4" /> 
          {!publicKey ? "Connect Wallet" : "Add Asset"}
        </Button>
      </div>

      {!publicKey ? (
        <EmptyState 
          icon={<Plus className="h-6 w-6" />}
          title="No Wallets Connected" 
          description="Connect a Freighter wallet to start spending your crypto."
          action={<Button onClick={connect}><Plus className="mr-2 h-4 w-4" /> Connect Wallet</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="relative group">
            <WalletCard 
              wallet={{ id: "freighter-1", address: publicKey, type: "FREIGHTER", isPrimary: true, name: "Freighter Wallet" } as any} 
              balance={balances.USDC} 
              assetCode="USDC" 
            />
          </div>
          <div className="relative group">
            <WalletCard 
              wallet={{ id: "freighter-2", address: publicKey, type: "FREIGHTER", isPrimary: false, name: "Freighter Wallet" } as any} 
              balance={balances.XLM} 
              assetCode="XLM" 
            />
          </div>
        </div>
      )}
    </div>
  );
}
