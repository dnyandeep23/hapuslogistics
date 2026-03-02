"use client";

import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { selectPackage, setStep } from '@/lib/redux/packageSlice';
import { AppDispatch } from '@/lib/redux/store';

export default function ContinueOrderPrompt() {
    const dispatch = useDispatch<AppDispatch>();
    const router = useRouter();
    const { formData, currentStep } = useSelector(selectPackage);

    const hasInProgressOrder = formData && formData.cart && formData.cart.length > 0;
    const packageImage =
        hasInProgressOrder &&
        typeof formData.cart[0].packageImage === "string" &&
        formData.cart[0].packageImage.length > 0
            ? formData.cart[0].packageImage
            : null;

    if (!hasInProgressOrder) {
        return null;
    }

    const handleContinue = () => {
        dispatch(setStep(currentStep || 1));
        router.push('/package');
    };

    return (
        <div className="mb-10">
            <div className="rounded-3xl bg-linear-to-r from-[#556447] via-[#3A4632] to-[#2A3324] p-[1px] shadow-[0_30px_70px_-45px_rgba(0,0,0,0.85)]">
                <div className="relative overflow-hidden rounded-3xl bg-[#242A1E] p-6 sm:p-8 text-white ring-1 ring-[#F6FF6A]/20">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(246,255,106,0.16),transparent_55%)]" />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.06),transparent_35%)]" />

                    <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-6">
                            {packageImage && (
                                <div className="relative h-30 w-30 sm:h-36 sm:w-36 overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.9)]">
                                    <Image
                                        src={packageImage}
                                        alt="In-progress package"
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 640px) 7.5rem, 9rem"
                                    />
                                </div>
                            )}
                            <div className="max-w-xl">
                                <span className="inline-flex items-center rounded-full border border-[#F6FF6A]/45 bg-[#F6FF6A]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#F6FF6A]">
                                    In progress
                                </span>
                                <h3 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-[#F6FF6A]">
                                    Resume your shipment
                                </h3>
                                <p className="mt-2 text-base sm:text-lg text-white/80">
                                    You have items waiting in your cart. Continue right where you left off.
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0">
                            <button
                                onClick={handleContinue}
                                className="rounded-xl bg-[#F6FF6A] px-8 py-3 text-base font-semibold text-[#1D1F16] shadow-[0_14px_30px_-18px_rgba(246,255,106,0.8)] transition-all hover:-translate-y-0.5 hover:bg-[#F0FA5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6FF6A]/70"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
