"use client";

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { verifyEmail } from '@/services/user';
import { Icon } from '@iconify/react';
import { getErrorMessage } from "@/lib/authError";
import AuthShell from "@/components/AuthShell";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your email, please wait...');

  useEffect(() => {
    const token = searchParams.get('token');

    const doVerification = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Verification token not found.');
        return;
      }

      try {
        await verifyEmail(token);
        setStatus('success');
        setMessage('Your email has been successfully verified! You can now log in.');
      } catch (error: unknown) {
        setStatus('error');
        setMessage(getErrorMessage(error, 'Verification failed. The link may be invalid or expired.'));
      }
    };

    const timer = setTimeout(doVerification, 1000);
    return () => clearTimeout(timer);
  }, [searchParams]);

  const renderIcon = () => {
    switch (status) {
      case 'verifying':
        return <Icon icon="line-md:loading-twotone-loop" width={60} className="text-gray-400" />;
      case 'success':
        return <Icon icon="line-md:confirm-circle" width={60} className="text-lime-500" />;
      case 'error':
        return <Icon icon="line-md:close-circle" width={60} className="text-red-500" />;
      default:
        return null;
    }
  };

  const textColor = () => {
    switch(status) {
        case 'success': return 'text-lime-400';
        case 'error': return 'text-red-400';
        default: return 'text-white/80';
    }
  }

  return (
    <AuthShell
      badge="Email verification"
      title="Verify your email address"
      description="We’ll confirm the verification token and show you the next step with a clear success or error state."
      supportLine="If the link expired, you can restart registration and request a fresh verification email."
      highlights={["Token check", "Secure confirmation", "Login next"]}
    >
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          {renderIcon()}
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Verification status</p>
          <h1 className="text-2xl font-bold text-white">Email Verification</h1>
          <p className={`text-base leading-7 transition-colors duration-300 ${textColor()}`}>{message}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {status === 'success' ? (
            <Link href="/login" className="inline-flex items-center justify-center rounded-full border border-[#D5E400]/25 bg-[#D5E400]/10 px-6 py-3 text-sm font-semibold text-[#F6FF6A] transition hover:bg-[#D5E400]/20">
              Go to Login
            </Link>
          ) : null}
          {status === 'error' ? (
            <Link href="/register" className="inline-flex items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 px-6 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20">
              Try Signing Up Again
            </Link>
          ) : null}
        </div>
      </div>
    </AuthShell>
  );
}


export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
        <div className="h-screen w-screen bg-gray-900 flex items-center justify-center text-white">
            <Icon icon="line-md:loading-twotone-loop" width={60} />
        </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
