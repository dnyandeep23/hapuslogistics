import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import homebg from "@/assets/images/homebg.png";
import OrderTrackingWidget from "@/components/OrderTrackingWidget";

export default function Banner() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#0A0D09]">
      {/* Background with left-to-right gradient to keep image visible */}
      <div className="absolute inset-0 z-0">
        <Image src={homebg} alt="Hapus logistics background" fill priority className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0D09] via-transparent to-transparent opacity-80" />
      </div>

      {/* Content Wrapper */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 pt-24 pb-12 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8">
        <div className="max-w-2xl w-full">
          <p className="text-xl sm:text-2xl font-medium text-white/80 mb-2 tracking-wide">
            Welcome to,
          </p>
          <h1 className="text-6xl tracking-tight font-black sm:text-7xl lg:text-[5.5rem] leading-[0.95] mb-8 bg-gradient-to-br from-[#D5E400] via-[#E4E67A] to-[#A0AC00] bg-clip-text text-transparent drop-shadow-sm">
            Hapus <br />
            Logistics
          </h1>

          <p className="text-lg text-white/70 mb-8 font-medium max-w-xl">
            Route logistics, continuous tracking, and reliable handling combined into a modern, trusted platform for everyone.
          </p>

          <p className="mt-12 text-sm text-white/40 italic font-mono tracking-tight hidden sm:block">
            "We treat your luggage as our priority at every step."
          </p>
        </div>

        <div className="w-full max-w-[28rem] lg:max-w-md group relative z-10 transition-all mt-8 lg:mt-20 shrink-0">
          <div className="absolute -inset-4 blur-3xl opacity-30 bg-gradient-to-br from-[#D5E400]/40 to-[#E4E67A]/10 rounded-[3rem] transition-opacity group-hover:opacity-50 pointer-events-none" />
          <OrderTrackingWidget mode="homepage" className="!bg-gradient-to-br !from-white/5 !to-white/[0.02] hover:!bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_20px_60px_-15px_rgba(213,228,0,0.1)] rounded-3xl" />
        </div>
      </div>
    </section>
  );
}
