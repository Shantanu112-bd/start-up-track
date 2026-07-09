'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cryptoPaySdk } from '@cryptopay/sdk';
import { useAppStore } from '../../lib/store';

export function KycPending() {
  const { setKycStatus } = useAppStore();
  const [status, setStatus] = React.useState<'PENDING' | 'SUCCESS'>('PENDING');

  React.useEffect(() => {
    let timer: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const me = await cryptoPaySdk.auth.getCurrentUser();
        if (me?.kycStatus === 'APPROVED' || me?.kycStatus === 'VERIFIED') {
          setStatus('SUCCESS');
          setKycStatus('VERIFIED');
          timer = setTimeout(() => {
            // Trigger a refresh/remount to unlock the app and move to children
            window.location.reload();
          }, 1500);
        } else if (me?.kycStatus === 'REJECTED' || me?.kycStatus === 'NOT_STARTED') {
          setKycStatus(me.kycStatus);
        }
      } catch (err) {
        console.error('Failed to poll KYC status', err);
      }
    };

    const interval = setInterval(pollStatus, 8000);
    pollStatus(); // initial check

    return () => {
      clearInterval(interval);
      if (timer) clearTimeout(timer);
    };
  }, [setKycStatus]);

  return (
    <div className="fixed inset-0 z-50 bg-[#E8E4DC] flex flex-col items-center justify-center p-6 text-black pb-safe">
      <div className="flex flex-col items-center max-w-sm w-full">
        {status === 'PENDING' ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-12 h-12 border-[3px] border-black border-t-transparent rounded-full mb-8"
            />
            <h1 className="font-mono text-[20px] font-bold mb-2">Verification in progress</h1>
            <p className="text-[14px] text-gray-500 text-center mb-12">
              We're reviewing your documents. This usually takes 2–5 minutes.
            </p>
          </>
        ) : (
          <>
            <motion.svg
              className="w-16 h-16 text-green-600 mb-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </motion.svg>
            <h1 className="font-mono text-[20px] font-bold mb-2">Verification successful!</h1>
            <p className="text-[14px] text-gray-500 text-center mb-12">
              You are ready to use Payra.
            </p>
          </>
        )}

        <div className="flex gap-2 items-center text-[12px] font-bold bg-white px-4 py-2 rounded-full border-[1.5px] border-black">
          <span className="text-gray-400">● Submitted</span>
          <span className="text-gray-300">›</span>
          <span className={status === 'PENDING' ? 'text-black' : 'text-gray-400'}>
            {status === 'PENDING' ? '⟳ Reviewing' : '● Reviewing'}
          </span>
          <span className="text-gray-300">›</span>
          <span className={status === 'SUCCESS' ? 'text-black' : 'text-gray-400'}>○ Complete</span>
        </div>
      </div>

      <div className="absolute bottom-12 left-0 right-0 flex justify-center">
        <a href="mailto:support@payra.in" className="text-[14px] font-bold text-gray-500 underline">
          Having trouble?
        </a>
      </div>
    </div>
  );
}
