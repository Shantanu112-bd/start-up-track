import * as React from "react";
import { cn } from "../lib/utils";
import { Wallet } from "@cryptopay/types";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { Badge } from "../foundation/Badge";

export interface WalletCardProps extends React.HTMLAttributes<HTMLDivElement> {
  wallet: Wallet;
  balance?: string;
  assetCode?: string;
}

export function WalletCard({ wallet, balance, assetCode = "USDC", className, ...props }: WalletCardProps) {
  const pk = wallet.publicKey || wallet.address || "Unknown";
  const shortAddress = pk.slice(0, 6) + "..." + pk.slice(-4);
  
  return (
    <Card className={cn("bg-gradient-to-br from-blue-900/20 to-black/40 border-blue-500/20", className)} {...props}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          {wallet.label || "Main Wallet"}
          {wallet.isPrimary && <Badge variant="success">Primary</Badge>}
        </CardTitle>
        <Badge variant={wallet.status === "ACTIVE" ? "success" : "secondary"}>
          {wallet.status}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="text-sm font-mono text-muted-foreground bg-black/20 p-2 rounded-md truncate">
            {shortAddress}
          </div>
          {balance !== undefined && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Balance</p>
              <p className="text-3xl font-bold tracking-tight">
                {balance} <span className="text-lg text-blue-400 font-normal">{assetCode}</span>
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
