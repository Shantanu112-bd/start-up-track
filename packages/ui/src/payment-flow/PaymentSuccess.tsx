import * as React from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "../cards/Card";
import { Button } from "../foundation/Button";

export interface PaymentSuccessProps {
  amount: string;
  currency: string;
  merchantName: string;
  onDone: () => void;
}

export function PaymentSuccess({ amount, currency, merchantName, onDone }: PaymentSuccessProps) {
  return (
    <Card className="max-w-md mx-auto text-center overflow-hidden">
      <CardContent className="pt-10 pb-8 px-6 flex flex-col items-center gap-6">
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="h-20 w-20 bg-green-500/20 rounded-full flex items-center justify-center text-green-500"
        >
          <CheckCircle2 className="h-10 w-10" />
        </motion.div>
        
        <div className="space-y-2">
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold"
          >
            Payment Successful
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground"
          >
            You have successfully paid {merchantName}
          </motion.p>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="text-4xl font-black my-4"
        >
          {amount} <span className="text-xl text-muted-foreground">{currency}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full mt-4"
        >
          <Button className="w-full" size="lg" onClick={onDone}>
            Done
          </Button>
        </motion.div>
      </CardContent>
    </Card>
  );
}
