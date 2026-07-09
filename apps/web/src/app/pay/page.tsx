"use client";

import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cryptoPaySdk } from "@cryptopay/sdk";
import { ArrowLeft, Copy, ExternalLink, X, Square, Minus, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { parseUpiQr, isUpiVpa } from "../../lib/upi-parser";
import { getWalletBalances } from "../../lib/horizon";
import { getAddress } from "@stellar/freighter-api";
import { useAppStore } from "../../lib/store";
import dynamic from "next/dynamic";

const QrScanner = dynamic(
  () => import("../../components/payment/QrScanner").then((mod) => mod.QrScanner),
  { ssr: false }
);
import { PaymentConfirm } from "../../components/auth/PaymentConfirm";

type PayStep = "SCAN" | "QUOTE" | "PROCESSING" | "SUCCESS";

export default function PayPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<PayStep>("SCAN");
  const [selectedAsset, setSelectedAsset] = React.useState<"USDC" | "XLM">("USDC");
  const [transactionId, setTransactionId] = React.useState<string | null>(null);
  const [showManualInput, setShowManualInput] = React.useState(false);
  const [manualVpa, setManualVpa] = React.useState("");
  const [showPaymentConfirm, setShowPaymentConfirm] = React.useState(false);
  
  const [payFeeWithStar, setPayFeeWithStar] = React.useState(false);
  
  const [scannedVpa, setScannedVpa] = React.useState<string>("");
  const [scannedMerchantName, setScannedMerchantName] = React.useState<string>("");
  const [scannedMerchantId, setScannedMerchantId] = React.useState<string | null>(null);
  const [amountPaise, setAmountPaise] = React.useState<string>("0");
  const [qrPayload, setQrPayload] = React.useState<string>("");
  const [txStatus, setTxStatus] = React.useState<string>("");

  const inputRef = React.useRef<HTMLInputElement>(null);

  const { kycStatus } = useAppStore()
  const isKycVerified = kycStatus === 'APPROVED' || kycStatus === 'VERIFIED'

  React.useEffect(() => {
    if (showManualInput && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showManualInput]);

  const { data: quote } = useQuery({
    queryKey: ["quote", selectedAsset, amountPaise],
    queryFn: () => cryptoPaySdk.transactions.getQuote({ assetIn: selectedAsset, amountInPaise: amountPaise || "0" }),
    enabled: step === "QUOTE" && Number(amountPaise) > 0,
  });

  const { data: wallets } = useQuery({
    queryKey: ["wallets"],
    queryFn: () => cryptoPaySdk.wallets.listWallets(),
  });

  const { data: walletBalances } = useQuery({
    queryKey: ["wallet-balances"],
    queryFn: async () => {
      const { address } = await getAddress();
      if (!address) return { xlm: "0", usdc: "0" };
      return getWalletBalances(address);
    },
    refetchInterval: 30000,
  });

  const createTxMutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        // Fallback UUID is ONLY for testnet demo purposes where the scanned VPA is not in the Payra merchant DB
        merchantId: scannedMerchantId || "11111111-1111-1111-1111-111111111111",
        assetIn: selectedAsset,
        amountInPaise: amountPaise,
        merchantUpiVpa: scannedVpa,
      };
      if (qrPayload) payload.qrPayload = qrPayload;
      if (wallets?.data?.[0]?.id) payload.walletId = wallets.data[0].id;
      return cryptoPaySdk.transactions.createTransaction(payload);
    },
    onSuccess: async (data: any) => {
      setTransactionId(data.id);
      setStep("PROCESSING");
      setTxStatus("ROUTING_STELLAR");
      
      const pollInterval = setInterval(async () => {
        try {
          const tx = await cryptoPaySdk.transactions.getTransaction(data.id);
          setTxStatus(tx.status);
          if (tx.status === "COMPLETED") {
            clearInterval(pollInterval);
            setStep("SUCCESS");
          } else if (tx.status === "FAILED" || tx.status === "CANCELLED") {
            clearInterval(pollInterval);
            alert("Payment failed: " + tx.failureMessage);
            setStep("SCAN");
          }
        } catch (e) {
          console.error("Poll error", e);
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(pollInterval);
        setStep((currentStep) => {
          if (currentStep === "PROCESSING") {
            alert("Payment timed out. Please try again.");
            return "SCAN";
          }
          return currentStep;
        });
      }, 60000);
    },
    onError: (err: any) => {
      console.error("Tx Creation Failed", err);
      alert("Payment failed: " + err.message);
      setStep("SCAN");
    }
  });

  const handleScanSuccess = async (decodedText: string) => {
    const parsed = parseUpiQr(decodedText);
    if (!parsed.isValid && !isUpiVpa(decodedText)) {
      alert("Invalid QR code. Please scan a valid UPI QR code.");
      return;
    }

    const vpa = parsed.isValid ? parsed.upiVpa : decodedText;

    try {
      const merchant = await cryptoPaySdk.merchants.findByVpa(vpa);
      if (merchant) {
        setScannedVpa(vpa);
        setScannedMerchantName(merchant.displayName);
        setScannedMerchantId(merchant.id);
      } else {
        setScannedVpa(vpa);
        setScannedMerchantName(parsed.merchantName || vpa);
        setScannedMerchantId(null);
      }
      setQrPayload(parsed.isValid ? decodedText : `upi://pay?pa=${vpa}&pn=${vpa}`);
      if (parsed.amount) {
        setAmountPaise((parsed.amount * 100).toFixed(0));
      } else {
        setAmountPaise("");
      }
      setStep("QUOTE");
    } catch {
      setScannedVpa(vpa);
      setScannedMerchantName(parsed.isValid ? parsed.merchantName || vpa : vpa);
      setScannedMerchantId(null);
      setQrPayload(parsed.isValid ? decodedText : `upi://pay?pa=${vpa}&pn=${vpa}`);
      if (parsed.amount) {
        setAmountPaise((parsed.amount * 100).toFixed(0));
      } else {
        setAmountPaise("");
      }
      setStep("QUOTE");
    }
  };

  const processingStepIndex = txStatus === "ROUTING_STELLAR" ? 0 : txStatus === "SETTLING" ? 1 : txStatus === "REWARDING" || txStatus === "COMPLETED" ? 2 : 0;

  if (step === "SCAN" && !isKycVerified) {
    return (
      <div className="flex flex-col items-center justify-center 
                      min-h-screen p-8 text-center bg-page text-black">
        <ShieldCheck className="w-16 h-16 mb-6" />
        <h2 className="font-mono text-xl font-bold mb-3">
          Verification required
        </h2>
        <p className="text-sm text-gray-500 mb-6 max-w-xs">
          Complete identity verification in your profile
          before making payments.
        </p>
        <Link href="/profile/trust">
          <button className="bg-black text-white font-bold px-8 py-3 rounded-full">
            GO TO VERIFICATION →
          </button>
        </Link>
      </div>
    );
  }

  return (
    <>
      {step === "SCAN" && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="absolute inset-0 overflow-hidden">
            <QrScanner
              onScanSuccess={handleScanSuccess}
              onScanError={() => {}}
            />
          </div>
          {/* Overlay 40% */}
          <div className="absolute inset-0 bg-black/40 pointer-events-none" />
          
          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 p-4 pt-safe flex items-center z-10">
            <button onClick={() => router.push('/dashboard')} className="p-2 bg-white/20 rounded-full text-white backdrop-blur-md">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>

          {/* Scan Box */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
            <div className="relative w-[280px] h-[280px]">
              {/* 4 corner brackets */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-white" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-white" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-white" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-white" />
            </div>
            <p className="mt-8 text-white text-[14px]">Point at any UPI QR code</p>
          </div>

          {/* Bottom Button */}
          <div className="absolute bottom-12 left-0 right-0 flex justify-center z-10">
            <button onClick={() => setShowManualInput(true)} className="text-white text-[14px] px-6 py-3 bg-white/20 rounded-full backdrop-blur-md">
              Enter UPI ID manually
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {step === "SCAN" && showManualInput && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[60]"
              onClick={() => setShowManualInput(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[24px] p-6 z-[70] pb-safe"
            >
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
              <h2 className="text-[16px] font-bold font-mono text-center mb-6 text-black">Enter UPI ID</h2>
              <input
                ref={inputRef}
                type="text"
                value={manualVpa}
                onChange={(e) => setManualVpa(e.target.value)}
                placeholder="merchant@upi"
                className="w-full border-[1.5px] border-black rounded-[12px] p-4 font-mono mb-4 outline-none focus:ring-2 focus:ring-[#C5D483]/50 text-black bg-white"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manualVpa.trim()) {
                    handleScanSuccess(manualVpa.trim());
                    setShowManualInput(false);
                    setManualVpa("");
                  }
                }}
              />
              <button 
                onClick={() => {
                  if (manualVpa.trim()) {
                    handleScanSuccess(manualVpa.trim());
                    setShowManualInput(false);
                    setManualVpa("");
                  }
                }}
                className="w-full bg-[#C5D483] text-black font-bold py-4 rounded-[12px]"
              >
                CONTINUE →
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {step === "QUOTE" && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col text-black">
          {/* Top section */}
          <div className="h-[40%] flex flex-col items-center justify-center relative bg-gray-50/50">
            <button onClick={() => setStep("SCAN")} className="absolute top-4 left-4 pt-safe p-2 text-black">
              <ArrowLeft className="w-6 h-6" />
            </button>
            
            <div className="w-12 h-12 rounded-full border-[1.5px] border-black flex items-center justify-center font-bold text-lg bg-white mb-4">
              {scannedMerchantName ? scannedMerchantName.slice(0, 2).toUpperCase() : "MP"}
            </div>
            <h2 className="font-bold text-[20px] mb-2">{scannedMerchantName || "Merchant"}</h2>
            <div className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-md flex items-center gap-1">
              UPI Verified <span className="text-[10px]">✓</span>
            </div>
          </div>

          {/* Middle section */}
          <div className="flex-1 px-6 pt-6 flex flex-col items-center overflow-y-auto pb-[60px]">
            <span className="text-[12px] font-mono text-gray-500 mb-2">You are paying</span>
            <div className="flex items-center justify-center mb-8">
              <span className="text-[48px] font-mono font-bold">₹</span>
              <input
                type="number"
                value={amountPaise ? (Number(amountPaise) / 100).toString() : ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 0) setAmountPaise((val * 100).toFixed(0));
                  else setAmountPaise("");
                }}
                placeholder="0.00"
                className="text-[48px] font-mono font-bold text-center w-[200px] outline-none bg-transparent"
              />
            </div>

            {/* Asset pills */}
            <div className="flex gap-2 w-full mb-8">
              <button 
                onClick={() => setSelectedAsset("XLM")}
                className={`flex-1 py-3 px-2 rounded-[12px] border-[1.5px] border-black text-center whitespace-nowrap transition-colors flex flex-col items-center ${selectedAsset === "XLM" ? "bg-black text-white" : "bg-white text-black"}`}
              >
                <span className="font-bold">XLM</span>
                <span className="opacity-70 text-[10px]">{walletBalances?.xlm || "0.00"} available</span>
              </button>
              <button 
                onClick={() => setSelectedAsset("USDC")}
                className={`flex-1 py-3 px-2 rounded-[12px] border-[1.5px] border-black text-center whitespace-nowrap transition-colors flex flex-col items-center ${selectedAsset === "USDC" ? "bg-black text-white" : "bg-white text-black"}`}
              >
                <span className="font-bold">USDC</span>
                <span className="opacity-70 text-[10px]">{walletBalances?.usdc || "0.00"} available</span>
              </button>
            </div>

            {/* Breakdown card */}
            <div className="w-full border-[1.5px] border-black rounded-[16px] p-4 space-y-3 mb-6">
              <div className="flex justify-between text-[14px]">
                <span className="text-gray-500">Rate</span>
                <span className="font-mono">1 {selectedAsset} = ₹{(Number(amountPaise) / 100 / (quote?.usdcAmount || 2.40)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-gray-500">Network fee</span>
                <span className="font-mono">~0.00001 XLM</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-gray-500">Platform fee</span>
                <span className="font-mono">{payFeeWithStar ? <><span className="line-through text-gray-400 mr-1">₹0.50</span><span className="text-green-600 font-bold">FREE</span></> : "₹0.50"}</span>
              </div>
              <div className="border-t-[1.5px] border-black border-dashed pt-3 flex justify-between items-center">
                <span className="font-bold">STAR reward</span>
                <span className="bg-[#C5D483] px-3 py-1 rounded-full font-bold text-[12px] border-[1.5px] border-black">
                  +{quote?.starReward || "25"} ⭐
                </span>
              </div>
            </div>

            {/* STAR fee toggle */}
            <div className="w-full flex items-center justify-between mb-8">
              <div>
                <div className="font-bold">Pay fee with STAR</div>
                <div className={`text-[12px] mt-0.5 ${payFeeWithStar ? "text-red-500 font-bold" : "text-gray-500"}`}>
                  {payFeeWithStar ? "−250 STAR burned" : "Burns 250 STAR · Saves ₹0.50"}
                </div>
              </div>
              <button 
                onClick={() => setPayFeeWithStar(!payFeeWithStar)}
                className={`w-12 h-6 rounded-full p-1 transition-colors flex ${payFeeWithStar ? "bg-black justify-end" : "bg-gray-300 justify-start"}`}
              >
                <motion.div layout className="w-4 h-4 bg-white rounded-full shadow-sm" />
              </button>
            </div>
          </div>

          {/* Bottom Button */}
          <div className="absolute bottom-0 left-0 right-0">
            <button 
              onClick={() => setShowPaymentConfirm(true)}
              disabled={createTxMutation.isPending || Number(amountPaise) <= 0}
              className="bg-[#C5D483] text-black font-bold h-[56px] w-full flex items-center justify-center border-t-[1.5px] border-black pb-safe disabled:opacity-50"
            >
              {createTxMutation.isPending ? "PROCESSING..." : "CONFIRM PAYMENT →"}
            </button>
          </div>
        </div>
      )}

      {step === "PROCESSING" && (
        <div className="fixed inset-0 z-50 bg-[#E8E4DC] flex flex-col items-center justify-center p-6 text-black">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-16 h-16 border-[4px] border-black border-t-transparent rounded-full mb-8"
          />
          <h2 className="font-mono font-bold text-[20px] mb-2">Processing on Stellar</h2>
          <p className="text-[13px] text-gray-500 mb-12">Do not close this app</p>

          <div className="flex items-center gap-2 w-full justify-center">
            {["Signing", "Broadcasting", "Confirming"].map((label, idx) => {
              const isActive = processingStepIndex === idx;
              const isDone = processingStepIndex > idx;
              return (
                <div 
                  key={label}
                  className={`px-3 py-1.5 rounded-full font-bold text-[12px] border-[1.5px] transition-colors ${
                    isActive ? "bg-black text-white border-black" : isDone ? "bg-[#C5D483] text-black border-black" : "bg-transparent text-gray-400 border-gray-400"
                  }`}
                >
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === "SUCCESS" && (
        <div className="fixed inset-0 z-50 bg-[#E8E4DC] flex items-center justify-center p-6">
          <div className="relative w-full max-w-sm">
            {/* Blue offset frame */}
            <div className="absolute inset-0 bg-[#3B7DE8] border-[1.5px] border-black rounded-[16px] transform translate-x-[-8px] translate-y-[8px]" />
            
            {/* Main card */}
            <div className="relative bg-white border-[1.5px] border-black rounded-[16px] overflow-hidden flex flex-col">
              {/* Window Chrome */}
              <div className="h-8 border-b-[1.5px] border-black bg-gray-50 flex items-center justify-between px-3">
                <div className="flex gap-2 text-black">
                  <Minus className="w-4 h-4" />
                  <Square className="w-4 h-4" />
                  <X className="w-4 h-4" />
                </div>
              </div>

              {/* Content */}
              <div className="p-8 flex flex-col items-center text-center text-black">
                <motion.svg 
                  className="w-16 h-16 text-green-500 mb-6" 
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                >
                  <motion.path 
                    initial={{ pathLength: 0 }} 
                    animate={{ pathLength: 1 }} 
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    strokeLinecap="round" strokeLinejoin="round" 
                    d="M5 13l4 4L19 7" 
                  />
                </motion.svg>

                <h2 className="font-mono font-bold text-[20px] mb-2">Payment complete</h2>
                <p className="text-[16px] mb-6">₹{(Number(amountPaise)/100).toFixed(2)} paid to {scannedMerchantName}</p>

                <div className="w-full bg-[#C5D483] border-[1.5px] border-black rounded-[12px] p-4 mb-6">
                  <div className="font-bold text-[16px]">⭐ +{quote?.starReward || "25"} STAR Earned</div>
                  <div className="text-[12px]">Added to your wallet</div>
                </div>

                <div className="w-full bg-gray-50 border-[1.5px] border-gray-200 rounded-[8px] p-3 flex flex-col items-start mb-8">
                  <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Transaction Hash</div>
                  <div className="flex justify-between items-center w-full">
                    <span className="font-mono text-[13px] truncate mr-2">{transactionId || "abc...xyz"}</span>
                    <div className="flex gap-2">
                      <Copy className="w-4 h-4 text-gray-500" />
                      <ExternalLink className="w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 w-full">
                  <button onClick={() => router.push('/dashboard')} className="flex-1 py-3 rounded-[12px] border-[1.5px] border-black font-bold hover:bg-gray-50">
                    DONE
                  </button>
                  <button onClick={() => setStep('SCAN')} className="flex-1 py-3 rounded-[12px] bg-black text-white font-bold border-[1.5px] border-black hover:bg-black/80">
                    PAY AGAIN →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showPaymentConfirm && (
          <PaymentConfirm
            amount={(Number(amountPaise) / 100).toFixed(2)}
            merchantName={scannedMerchantName}
            starReward={quote?.starReward || '0'}
            onConfirmed={() => {
              setShowPaymentConfirm(false);
              createTxMutation.mutate();
            }}
            onCancelled={() => setShowPaymentConfirm(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
