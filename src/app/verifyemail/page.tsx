"use client";

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { verifyEmail } from '@/services/user';
import { Icon } from '@iconify/react';
import Loginvector from "@/assets/images/loginvector.png";
import { getErrorMessage } from "@/lib/authError";

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
    <section>
        <div className="relative h-screen flex flex-col justify-end py-12 px-6 md:py-20 md:px-20">
            <Link href={"/"} className="absolute top-4 right-4 z-50">
            <div className="flex gap-2 items-center bg-gray-600/60 hover:bg-gray-700 cursor-pointer px-4 py-2 rounded-lg ">
                <Icon icon="solar:home-2-broken" />
                <span>Return to Home</span>
            </div>
            </Link>
            <div className="absolute bg-[#25421E] top-0 left-0 w-[75%] rounded-br-[60%] h-full"></div>
            <div className="absolute inset-0 h-full w-[70%]  flex flex-col">
            <Image src={Loginvector} alt="vector image" className='object-cover'></Image>
            </div>
            <div className="flex ml-6  items-center  gap-8">
            <p className="z-50 relative text-9xl font-bold text-white">Hapus</p>
            <p className="z-50 mt-4 text text-center relative text-3xl font-medium text-white line-clamp-2">
                Travels & <br /> Logistics
            </p>
            </div>
            <div>
            <p className="z-50 ml-6 relative mt-12 text-white/80">
                Log in with confidence — your luggage is in safe hands with Hapus
                Logistics.
            </p>
            </div>

            {/* Verification Status Card */}
            <div className="absolute right-4 bottom-6 md:right-24 md:bottom-24 bg-black/40 px-6 md:px-12 py-8 md:py-14 rounded-[8%] flex flex-col w-full md:w-120 items-center text-center">
                <div className="mb-6">
                    {renderIcon()}
                </div>
                <h1 className="text-white font-bold text-3xl mb-3">Email Verification</h1>
                <p className={`text-lg transition-colors duration-300 ${textColor()}`}>{message}</p>
                {status === 'success' && (
                    <Link href="/login" className="mt-8 px-8 py-2 rounded-full border border-[#D5E400] text-[#D5E400] font-semibold transition-all duration-300 hover:bg-[#D5E400] hover:text-black">
                        Go to Login
                    </Link>
                )}
                 {status === 'error' && (
                    <Link href="/register" className="mt-8 px-8 py-2 rounded-full border border-red-500 text-red-400 font-semibold transition-all duration-300 hover:bg-red-500 hover:text-white">
                        Try Signing Up Again
                    </Link>
                )}
            </div>
        </div>
    </section>
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
