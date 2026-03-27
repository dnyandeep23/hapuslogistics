"use client";
import React from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import applogo from "@/assets/images/applogo.png";
import { useAppSelector } from "@/lib/redux/hooks";

export default function MobileHeader() {
  const { user } = useAppSelector((state) => state.user);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[linear-gradient(180deg,rgba(20,26,19,0.8),rgba(15,20,14,0.85))] backdrop-blur-xl sticky top-0 z-40 lg:hidden">
      <div className="flex items-center gap-2">
        <Image src={applogo} alt="Hapus Logistics logo" width={32} height={32} className="h-8 w-auto object-contain" priority />
        {/* <span className="text-sm font-semibold tracking-wider text-[#F6FF6A]">HAPUS</span> */}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="relative flex h-8 w-8 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#C5D2AC] shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-transform active:scale-95">
          <Icon icon="mdi:bell-outline" className="text-lg" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#d5e400]" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#d5e400,#8fa82f)] text-xs font-bold text-[#14210d] shadow-[0_4px_12px_rgba(213,228,0,0.2)]">
          {user?.name?.[0]?.toUpperCase() ?? "U"}
        </div>
      </div>
    </div>
  );
}
