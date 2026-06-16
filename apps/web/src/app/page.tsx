"use client";

import * as React from "react";
import { useAppStore } from "../lib/store";
import { useRouter } from "next/navigation";
import { Button } from "@cryptopay/ui";
import { Wallet, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useStellarWallet } from "../components/providers/StellarWalletProvider";

export default function Home() {
  const { currentUserId, setCurrentUserId } = useAppStore();
  const router = useRouter();
  const { connect, publicKey, isConnecting } = useStellarWallet();

  // If already "logged in", redirect to dashboard
  React.useEffect(() => {
    if (publicKey) {
      setCurrentUserId(publicKey);
      router.push("/dashboard");
    } else if (currentUserId) {
      router.push("/dashboard");
    }
  }, [publicKey, currentUserId, router, setCurrentUserId]);

  const handleLogin = async () => {
    await connect();
  };

  if (currentUserId || publicKey) return null; // Avoid flicker before redirect

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black bg-grid-white/[0.05]">
      <div className="absolute inset-0 bg-black/60 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(37,99,235,0.3),rgba(255,255,255,0))]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 flex flex-col items-center text-center space-y-6 max-w-lg px-4"
      >
        <div className="h-16 w-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/50 mb-4">
          <span className="text-white font-bold text-3xl">C</span>
        </div>
        
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
          The Future of Payment
        </h1>
        
        <p className="text-lg text-muted-foreground">
          Spend your digital assets anywhere. Instant settlement over Stellar rails. Real-world utility.
        </p>

        <div className="pt-8 w-full">
          <Button 
            size="lg" 
            className="w-full text-lg h-14 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/20"
            onClick={handleLogin}
            disabled={isConnecting}
          >
            {isConnecting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wallet className="mr-2 h-5 w-5" />}
            {isConnecting ? "Connecting..." : "Connect Freighter Wallet"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
