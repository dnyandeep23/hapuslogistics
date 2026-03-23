"use client";

import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Icon } from '@iconify/react';
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
            <div className="rounded-3xl bg-linear-to-r from-[#556447] via-[#3A4632] to-[#2A3324] p-px shadow-[0_30px_70px_-45px_rgba(0,0,0,0.85)]">
                <div className="relative overflow-hidden rounded-3xl bg-[#242A1E] text-white ring-1 ring-[#F6FF6A]/20">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(246,255,106,0.16),transparent_40%)]" />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(255,255,255,0.08),transparent_32%,rgba(255,255,255,0.02))]" />
                    <div className="relative z-10 grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                        <div className="flex items-start gap-4 sm:gap-5">
                            <div className="flex shrink-0 flex-col items-center gap-3">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#F6FF6A]/25 bg-[#F6FF6A]/10 text-[#F6FF6A] shadow-[0_16px_36px_-24px_rgba(246,255,106,0.8)]">
                                    <Icon icon="mdi:progress-clock" className="text-2xl" />
                                </div>
                                <span className="hidden h-full w-px bg-gradient-to-b from-[#F6FF6A]/50 via-white/10 to-transparent sm:block" />
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F6FF6A]/30 bg-[#F6FF6A]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#F6FF6A]">
                                        <Icon icon="mdi:autorenew" className="text-sm" />
                                        In progress
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/70">
                                        <Icon icon="mdi:shape-outline" className="text-sm" />
                                        Step {currentStep || 1}
                                    </span>
                                </div>

                                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                                    {packageImage && (
                                        <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.9)] sm:w-28">
                                            <Image
                                                src={packageImage}
                                                alt="In-progress package"
                                                fill
                                                className="object-cover"
                                                sizes="(max-width: 640px) 6rem, 7rem"
                                            />
                                        </div>
                                    )}

                                    <div className="max-w-xl">
                                        <h3 className="text-2xl font-semibold tracking-tight text-[#F6FF6A] sm:text-3xl">
                                            Resume your shipment
                                        </h3>
                                        <p className="mt-2 max-w-prose text-sm leading-6 text-white/72 sm:text-base">
                                            Your draft is saved and ready. Pick up where you left off without starting over.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex shrink-0 lg:justify-end">
                            <button
                                onClick={handleContinue}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F6FF6A] px-5 py-3 text-sm font-semibold text-[#1D1F16] shadow-[0_16px_34px_-20px_rgba(246,255,106,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#F0FA5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6FF6A]/70"
                            >
                                Continue
                                <Icon icon="mdi:arrow-right" className="text-lg" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
