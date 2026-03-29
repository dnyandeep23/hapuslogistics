"use client";

import Image from "next/image";
import homebg from "@/assets/images/homebg.png";
import OrderTrackingWidget from "@/components/OrderTrackingWidget";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

export default function Banner() {
  const { isMobile, isTablet } = useResponsiveMode();

  return (
    <section className={`relative flex items-center overflow-hidden bg-[#0A0D09] ${isMobile ? "min-h-[auto] py-24" : "min-h-screen"}`}>
      {/* Background with left-to-right gradient to keep image visible */}
      <div className="absolute inset-0 z-0">
        <Image src={homebg} alt="Hapus logistics background" fill priority className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0D09] via-transparent to-transparent opacity-80" />
      </div>

      {/* Content Wrapper */}
      <div className={`relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-12 px-6 pt-24 pb-12 sm:px-8 ${isMobile ? "flex-col gap-8" : isTablet ? "flex-col gap-10" : "flex-col lg:flex-row lg:gap-8"}`}>
        <div className="max-w-2xl w-full">
          <p className={`${isMobile ? "text-base" : "text-xl sm:text-2xl"} mb-2 font-medium tracking-wide text-white/80`}>
            Welcome to,
          </p>
          <h1 className={`${isMobile ? "text-[3.25rem]" : isTablet ? "text-6xl sm:text-7xl" : "text-6xl sm:text-7xl lg:text-[5.5rem]"} mb-8 leading-[0.95] font-black tracking-tight bg-gradient-to-br from-[#D5E400] via-[#E4E67A] to-[#A0AC00] bg-clip-text text-transparent drop-shadow-sm`}>
            Hapus <br />
            Logistics
          </h1>

          <p className={`${isMobile ? "text-base leading-7" : "text-lg"} mb-8 max-w-xl font-medium text-white/70`}>
            {isMobile
              ? "Book, track, and manage shipments with a cleaner handheld flow built for quick decisions."
              : isTablet
                ? "Book, track, and manage shipments with a balanced workspace that stays easy to scan."
                : "Route logistics, continuous tracking, and reliable handling combined into a modern, trusted platform for everyone."}
          </p>

          <div className={`flex flex-wrap gap-2 ${isMobile ? "mb-6" : "mb-0"}`}>
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70">
              {isMobile ? "Mobile-first actions" : isTablet ? "Tablet-ready workspace" : "Desktop control surface"}
            </span>
            <span className="inline-flex items-center rounded-full border border-[#D5E400]/15 bg-[#D5E400]/10 px-3 py-1.5 text-xs font-medium text-[#E4E67A]">
              Real-time tracking
            </span>
          </div>

          <p className="mt-12 hidden text-sm italic tracking-tight text-white/40 sm:block font-mono">
            &ldquo;We treat your luggage as our priority at every step.&rdquo;
          </p>
        </div>

        <div className={`group relative z-10 w-full shrink-0 transition-all ${isMobile ? "max-w-full" : "max-w-[28rem] lg:max-w-md"} ${isMobile ? "mt-0" : "mt-8 lg:mt-20"}`}>
          <div className="absolute -inset-4 blur-3xl opacity-30 bg-gradient-to-br from-[#D5E400]/40 to-[#E4E67A]/10 rounded-[3rem] transition-opacity group-hover:opacity-50 pointer-events-none" />
          <OrderTrackingWidget mode="homepage" className="!bg-gradient-to-br !from-white/5 !to-white/[0.02] hover:!bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_20px_60px_-15px_rgba(213,228,0,0.1)] rounded-3xl" />
        </div>
      </div>
    </section>
  );
}
