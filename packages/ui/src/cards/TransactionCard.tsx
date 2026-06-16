import * as React from "react";
import { Transaction } from "@cryptopay/types";
import { Card, CardContent } from "./Card";
import { Badge } from "../foundation/Badge";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "../lib/utils";

export interface TransactionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  transaction: Transaction;
  isOutbound?: boolean;
}

export function TransactionCard({ transaction, isOutbound = true, className, ...props }: TransactionCardProps) {
  const amount = (parseInt(transaction.amountInPaise) / 100).toFixed(2);
  const Icon = isOutbound ? ArrowUpRight : ArrowDownRight;
  
  return (
    <Card className={cn("p-4 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer", className)} {...props}>
      <div className="flex items-center gap-4">
        <div className={cn("p-3 rounded-full", isOutbound ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500")}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold">{transaction.merchantId || "Payment"}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(transaction.createdAt).toLocaleDateString()} • {transaction.rail}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className={cn("font-bold", isOutbound ? "" : "text-green-500")}>
          {isOutbound ? "-" : "+"}{amount} INR
        </p>
        <Badge variant={transaction.status === "COMPLETED" ? "success" : "secondary"} className="mt-1">
          {transaction.status}
        </Badge>
      </div>
    </Card>
  );
}
