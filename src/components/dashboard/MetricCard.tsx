"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

type MetricCardProps = {
  label: string;
  value: string | number;
  icon: string;
  hint?: string;
};

export default function MetricCard({ label, value, icon, hint }: MetricCardProps) {
  const { isMobile, isTablet } = useResponsiveMode();

  return (
    <div className={`dashboard-surface-soft rounded-2xl ${isMobile ? "p-3.5" : "p-4"} ${isTablet ? "min-h-[7.5rem]" : ""}`}>
      <div className={`flex items-start justify-between gap-3 ${isMobile ? "mb-2" : "mb-3"}`}>
        <p className={`uppercase tracking-wide text-white/75 ${isMobile ? "text-[10px]" : "text-xs"}`}>{label}</p>
        <Icon icon={icon} className={`${isMobile ? "text-lg" : "text-xl"} text-[#E4E67A]`} />
      </div>
      <p className={`${isMobile ? "text-lg" : "text-2xl"} font-semibold leading-tight text-[#E4E67A]`}>{value}</p>
      {hint && <p className={`mt-2 text-white/65 ${isMobile ? "text-[11px] leading-4" : "text-xs"}`}>{hint}</p>}
    </div>
  );
}
