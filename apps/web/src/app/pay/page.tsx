"use client";

import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cryptoPaySdk } from "@cryptopay/sdk";
import { PaymentSuccess, Button, Card, CardContent, Skeleton } from "@cryptopay/ui";
import { QrCode, ArrowRight, Wallet, CheckCircle2, Star, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../../lib/store";

type PayStep = "SCAN" | "QUOTE" | "ASSET_SELECTION" | "CONFIRM" | "PROCESSING" | "SUCCESS" | "REWARD";

// Hardcoded merchant details for demo flow
const DEMO_MERCHANT_ID = "11111111-1111-1111-1111-111111111111"; // Mock UUID
const DEMO_VPA = "chaipoint@upi";
const DEMO_AMOUNT_PAISE = "20000"; // 200 INR

export default function PayPage() {
  const router = useRouter();
  const { currentUserId } = useAppStore();
  const [step, setStep] = React.useState<PayStep>("SCAN");
  const [selectedAsset, setSelectedAsset] = React.useState<"USDC" | "XLM">("USDC");
  const [transactionId, setTransactionId] = React.useState<string | null>(null);

  // Fetch Quote when entering QUOTE or CONFIRM states
  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ["quote", selectedAsset, DEMO_AMOUNT_PAISE],
    queryFn: () => cryptoPaySdk.transactions.getQuote({ assetIn: selectedAsset, amountInPaise: DEMO_AMOUNT_PAISE }),
    enabled: step === "QUOTE" || step === "CONFIRM" || step === "ASSET_SELECTION",
  });

  // Fetch Wallets for Asset Selection
  const { data: wallets } = useQuery({
    queryKey: ["wallets"],
    queryFn: () => cryptoPaySdk.wallets.list(),
  });

  // Transaction Creation Mutation
  const createTxMutation = useMutation({
    mutationFn: () => cryptoPaySdk.transactions.createTransaction({
      merchantId: DEMO_MERCHANT_ID,
      assetIn: selectedAsset,
      amountInPaise: DEMO_AMOUNT_PAISE,
      merchantUpiVpa: DEMO_VPA,
      walletId: wallets?.[0]?.id,
    }),
    onSuccess: async (data) => {
      setTransactionId(data.id);
      setStep("PROCESSING");
      // Fast-forward processing via simulate
      try {
        await cryptoPaySdk.transactions.simulateTransaction(data.id);
      } catch (e) {
        console.warn("Simulation failed, likely due to mock DB state", e);
      }
      // Wait for dramatic effect
      setTimeout(() => {
        setStep("SUCCESS");
        // Show rewards shortly after success
        setTimeout(() => setStep("REWARD"), 2500);
      }, 2000);
    },
    onError: (err) => {
      console.error("Tx Creation Failed", err);
      // In a real app we'd show a proper error UI state
      alert("Payment failed: " + err.message);
      setStep("SCAN");
    }
  });

  // Handlers
  const handleScan = () => {
    // In real app, this parses a camera feed
    setStep("QUOTE");
  };

  const handleAssetSelect = (asset: "USDC" | "XLM") => {
    setSelectedAsset(asset);
    setStep("CONFIRM");
  };

  // Variants for Framer Motion
  const slideVariants = {
    enter: { x: 50, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -50, opacity: 0 },
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4 h-[calc(100vh-140px)] flex flex-col justify-center relative">
      <AnimatePresence mode="wait">
        
        {/* STEP 1: SCAN */}
        {step === "SCAN" && (
          <motion.div key="scan" variants={slideVariants} initial="enter" animate="center" exit="exit" className="w-full">
            <Card className="border-blue-500/20 bg-blue-900/5 shadow-2xl shadow-blue-900/20">
              <CardContent className="p-10 text-center flex flex-col items-center">
                <div className="relative mb-8">
                  <div className="absolute -inset-8 bg-blue-500/20 blur-2xl rounded-full animate-pulse" />
                  <div className="h-32 w-32 border-4 border-blue-500/50 rounded-3xl flex items-center justify-center relative z-10 bg-black/40 backdrop-blur-sm">
                    <QrCode className="h-16 w-16 text-blue-400" />
                    {/* Scanner scanning animation line */}
                    <motion.div 
                      className="absolute top-0 left-0 w-full h-1 bg-blue-400 shadow-[0_0_10px_#60a5fa]"
                      animate={{ top: ["0%", "100%", "0%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-2">Scan to Pay</h2>
                <p className="text-muted-foreground mb-8 text-sm">
                  Scan any merchant's UPI QR code to instantly pay with your crypto wallet.
                </p>
                <div className="w-full space-y-3">
                  <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleScan}>
                    Simulate QR Scan
                  </Button>
                  <Button variant="outline" size="lg" className="w-full">Upload from Gallery</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* STEP 2: QUOTE & CONFIRM (Combined visually) */}
        {(step === "QUOTE" || step === "CONFIRM") && (
          <motion.div key="quote" variants={slideVariants} initial="enter" animate="center" exit="exit" className="w-full">
            <Card className="overflow-hidden border-white/10 shadow-2xl">
              <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setStep("SCAN")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h2 className="text-lg font-bold leading-tight">Chai Point</h2>
                  <p className="text-xs text-muted-foreground">{DEMO_VPA}</p>
                </div>
              </div>
              <CardContent className="p-6 space-y-6">
                
                {/* Exchange Direction */}
                <div className="flex justify-between items-center p-5 bg-black/40 rounded-2xl border border-white/5">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">You Pay</p>
                    <div 
                      className="flex items-baseline justify-center gap-1 cursor-pointer hover:bg-white/5 p-2 -m-2 rounded-lg transition-colors"
                      onClick={() => setStep("ASSET_SELECTION")}
                    >
                      {quoteLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        <>
                          <span className="text-3xl font-bold">{quote?.usdcAmount || "2.40"}</span>
                          <span className="text-sm text-blue-400 font-medium bg-blue-500/10 px-2 py-0.5 rounded-full">{selectedAsset}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center">
                    <ArrowRight className="text-muted-foreground h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Merchant Receives</p>
                    <div className="flex items-baseline justify-center gap-1 pt-2">
                      <span className="text-3xl font-bold">200</span>
                      <span className="text-sm text-green-400 font-medium">INR</span>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3 text-sm px-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Exchange Rate</span>
                    <span className="text-foreground">
                      {quoteLoading ? <Skeleton className="h-4 w-20" /> : `1 ${selectedAsset} = ${(200 / (quote?.usdcAmount || 2.40)).toFixed(2)} INR`}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Network Fee (Stellar)</span>
                    <span className="text-foreground">~0.00001 XLM</span>
                  </div>
                  <div className="flex justify-between font-medium pt-3 border-t border-white/10 text-white items-center">
                    <span className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" /> STAR Rewards
                    </span>
                    <span className="text-yellow-500 font-bold">+10 STAR</span>
                  </div>
                </div>

                <div className="pt-4">
                  <Button 
                    className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/20" 
                    onClick={() => createTxMutation.mutate()}
                    disabled={createTxMutation.isPending}
                  >
                    Swipe to Pay
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* STEP 3: ASSET SELECTION */}
        {step === "ASSET_SELECTION" && (
          <motion.div key="assets" variants={slideVariants} initial="enter" animate="center" exit="exit" className="w-full">
            <Card>
              <div className="p-4 border-b border-white/10 flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setStep("QUOTE")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-lg font-bold">Select Asset</h2>
              </div>
              <CardContent className="p-4 space-y-2">
                {["USDC", "XLM"].map((asset) => (
                  <div 
                    key={asset} 
                    onClick={() => handleAssetSelect(asset as any)}
                    className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors border ${selectedAsset === asset ? "bg-blue-600/20 border-blue-500/50" : "bg-white/5 border-white/5 hover:bg-white/10"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${asset === "USDC" ? "bg-blue-500/20 text-blue-400" : "bg-white/10 text-white"}`}>
                        {asset[0]}
                      </div>
                      <div>
                        <p className="font-bold">{asset}</p>
                        <p className="text-xs text-muted-foreground">Available: {asset === "USDC" ? "1,240.50" : "450.00"}</p>
                      </div>
                    </div>
                    {selectedAsset === asset && <CheckCircle2 className="text-blue-500 h-5 w-5" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* STEP 4: PROCESSING */}
        {step === "PROCESSING" && (
          <motion.div key="processing" variants={slideVariants} initial="enter" animate="center" exit="exit" className="w-full text-center">
            <div className="h-32 w-32 mx-auto mb-8 relative flex items-center justify-center">
              <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="absolute inset-0 border-4 border-blue-500/30 border-t-blue-500 rounded-full"
              />
              <Wallet className="h-10 w-10 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Processing Payment</h2>
            <p className="text-muted-foreground">Routing through the Stellar network...</p>
          </motion.div>
        )}

        {/* STEP 5: SUCCESS */}
        {step === "SUCCESS" && (
          <motion.div key="success" variants={slideVariants} initial="enter" animate="center" exit="exit" className="w-full">
            <PaymentSuccess 
              amount="200" 
              currency="INR" 
              merchantName="Chai Point" 
              onDone={() => router.push("/dashboard")} 
            />
          </motion.div>
        )}

        {/* STEP 6: REWARD ANIMATION OVERLAY */}
        {step === "REWARD" && (
          <motion.div key="reward" variants={slideVariants} initial="enter" animate="center" exit="exit" className="w-full">
            <Card className="overflow-hidden border-purple-500/30 bg-purple-900/10 shadow-2xl shadow-purple-900/20 text-center relative">
              <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 bg-purple-500/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-40 w-40 bg-blue-500/20 rounded-full blur-3xl" />
              
              <CardContent className="p-10 flex flex-col items-center">
                <motion.div 
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="h-24 w-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/30 mb-6 relative"
                >
                  <Star className="h-12 w-12 text-white fill-white" />
                  <motion.div 
                    animate={{ opacity: [0, 1, 0], scale: [0.8, 1.2, 0.8] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute -top-2 -right-2"
                  >
                    <Sparkles className="h-6 w-6 text-yellow-200" />
                  </motion.div>
                </motion.div>
                
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-200 to-yellow-500 mb-2">
                  +10 STAR
                </h2>
                <p className="text-purple-200/80 mb-8 max-w-[200px] leading-tight">
                  You earned rewards for paying with CryptoPay!
                </p>
                
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white" onClick={() => router.push("/dashboard")}>
                  Return to Dashboard
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
