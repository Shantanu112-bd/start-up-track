import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../cards/Card";
import { Button } from "../foundation/Button";
import { Sparkles } from "lucide-react";
import { cn } from "../lib/utils";

export interface RewardBalanceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  starBalance: string | number;
  onClaim?: () => void;
}

export function RewardBalanceCard({ starBalance, onClaim, className, ...props }: RewardBalanceCardProps) {
  return (
    <Card className={cn("bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-black/40 border-purple-500/30 overflow-hidden relative", className)} {...props}>
      <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 bg-purple-500/20 rounded-full blur-2xl" />
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-purple-200 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-yellow-400" />
          STAR Rewards Balance
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between">
        <div>
          <p className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-purple-200">
            {starBalance}
          </p>
          <p className="text-xs text-purple-300 mt-1">Available to redeem</p>
        </div>
        {onClaim && (
          <Button variant="glass" size="sm" onClick={onClaim} className="border-purple-500/50 hover:bg-purple-500/20 text-purple-100">
            Redeem
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
