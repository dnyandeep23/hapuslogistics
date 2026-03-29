"use client";

import React from "react";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

type CardProps = {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export default function Card({ title, subtitle, action, children, className = "" }: CardProps) {
  const { isMobile, isTablet } = useResponsiveMode();

  return (
    <section className={`dashboard-surface rounded-2xl ${isMobile ? "p-4" : isTablet ? "p-5" : "p-5"} ${className}`}>
      {(title || subtitle || action) && (
        <div className={`mb-4 flex gap-3 ${isMobile ? "flex-col" : "items-start justify-between"}`}>
          <div className="min-w-0">
            {title && <h3 className={`font-semibold text-[#E4E67A] ${isMobile ? "text-sm" : "text-base"}`}>{title}</h3>}
            {subtitle && <p className={`mt-1 text-white/70 ${isMobile ? "text-[11px] leading-4" : "text-xs"}`}>{subtitle}</p>}
          </div>
          {action ? <div className={`${isMobile ? "w-full" : "shrink-0"}`}>{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
