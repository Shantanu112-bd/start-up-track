'use client';

import * as React from 'react';
import { ShieldCheck } from 'lucide-react';
import { cryptoPaySdk } from '@cryptopay/sdk';
import { useAppStore } from '../../lib/store';

export function KycOnboarding() {
  const { kycStatus, setKycStatus } = useAppStore();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleStartKyc() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await cryptoPaySdk.kyc.start();
      window.open(result.verificationUrl, '_blank');
      setKycStatus('PENDING');
    } catch (err) {
      setError('Failed to start verification. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#E8E4DC] flex flex-col items-center pt-20 p-6 text-[#1A1A1A] pb-safe">
      <div className="font-mono text-[24px] font-bold mb-12">⟠ Payra</div>

      <div className="flex flex-col items-center flex-1 w-full max-w-sm">
        <ShieldCheck className="w-16 h-16 mb-6 text-[#1A1A1A]" />
        
        <h1 className="font-mono text-[22px] font-bold mb-3 text-center">Verify your identity</h1>
        
        <p className="text-[14px] text-gray-600 text-center mb-8 max-w-[280px]">
          Indian regulations require identity verification before you can make payments. This takes about 2 minutes.
        </p>

        <div className="flex flex-col gap-4 w-full mb-12">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[12px]">✓</div>
            <span className="font-bold">PAN card verification</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[12px]">✓</div>
            <span className="font-bold">Aadhaar or government ID</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[12px]">✓</div>
            <span className="font-bold">Live selfie check</span>
          </div>
        </div>

        {kycStatus === 'REJECTED' && (
          <div className="w-full bg-amber-100 border border-amber-500 rounded-lg p-4 mb-6 text-center text-amber-900">
            <p className="font-bold mb-1">Previous verification failed</p>
            <p className="text-[14px]">Please try again with clear document photos</p>
          </div>
        )}

        {error && (
          <div className="w-full bg-red-100 border border-red-500 rounded-lg p-3 mb-6 text-center text-red-900 text-[14px]">
            {error}
          </div>
        )}

        <div className="mt-auto w-full flex flex-col items-center">
          <button
            onClick={handleStartKyc}
            disabled={isLoading}
            className="w-full bg-[#C5D483] text-black font-bold py-4 rounded-full border-[1.5px] border-black mb-6 flex justify-center items-center"
          >
            {isLoading ? 'STARTING...' : kycStatus === 'REJECTED' ? 'RETRY VERIFICATION →' : 'START VERIFICATION →'}
          </button>
          
          <p className="text-[12px] text-gray-500">Powered by KYCAID · Your data is encrypted</p>
        </div>
      </div>
    </div>
  );
}
