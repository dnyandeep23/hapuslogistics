"use client";

import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
import { Icon } from "@iconify/react";
import type { ReactNode } from "react";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

type AuthShellProps = {
  badge?: string;
  title: string;
  description: string;
  supportLine?: string;
  highlights?: string[];
  homeLabel?: string;
  homeHref?: string;
  artwork?: StaticImageData;
  artworkAlt?: string;
  className?: string;
  children: ReactNode;
};

export default function AuthShell({
  badge = "Secure access",
  title,
  description,
  supportLine,
  highlights = [],
  homeLabel = "Return to Home",
  homeHref = "/",
  artwork,
  artworkAlt = "Authentication artwork",
  className = "",
  children,
}: AuthShellProps) {
  const { isMobile, isTablet } = useResponsiveMode();
  const trimmedHighlights = highlights.filter(Boolean).slice(0, 3);
  const isCompact = isMobile;
  const shellMaxWidth = isMobile ? "max-w-[40rem]" : "max-w-[88rem]";
  const cardWidth = isMobile ? "w-full" : "lg:w-[31rem]";
  const artworkFrameClass = isCompact
    ? "absolute inset-x-4 top-16 h-[40%]"
    : isTablet
      ? "absolute inset-x-[20%] top-8 h-[50%]"
      : "absolute bottom-[20%] right-[6%] left-[30%] top-10";

  return (
    <section className={`relative min-h-screen overflow-hidden bg-[#0A0D09] text-white ${className}`}>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#274824_0%,#4b6c36_36%,#222920_36%,#121512_100%)]" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_top,rgba(213,228,0,0.14),transparent_64%)]" />
        <div className="absolute left-[-6rem] top-20 h-72 w-72 rounded-full bg-[#D5E400]/8 blur-3xl" />
        <div className="absolute right-[-8rem] top-24 h-80 w-80 rounded-full bg-white/4 blur-3xl" />
      </div>

      <div className="absolute right-3 top-3 z-20 sm:right-6 sm:top-6">
        <Link
          href={homeHref}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3.5 py-2 text-sm font-medium text-white/85 transition hover:bg-white/12 hover:text-white"
          aria-label={homeLabel}
        >
          <Icon icon="solar:home-2-broken" className="text-sm" />
          <span className="hidden sm:inline">{homeLabel}</span>
        </Link>
      </div>

      <div
        className={`relative z-10 mx-auto flex w-full ${shellMaxWidth} flex-col gap-5 px-4 pb-8 pt-20 sm:px-6 sm:pb-12 sm:pt-24 lg:grid lg:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)] lg:items-center lg:gap-8 lg:px-8 lg:py-10 ${
          isMobile ? "lg:grid-cols-1" : ""
        }`}
      >
        <div className="relative order-1 lg:min-h-[46rem]">
          <div className="relative flex h-full min-h-[16rem] overflow-hidden rounded-[2.4rem] border border-white/10 bg-[linear-gradient(145deg,rgba(41,77,43,0.95)_0%,rgba(24,43,22,0.96)_46%,rgba(13,16,12,0.98)_100%)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.28)] sm:min-h-[21rem] sm:p-7 lg:min-h-[46rem] lg:p-10">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_26%,rgba(0,0,0,0.08)_100%)]" />
            {artwork ? (
              <div className="pointer-events-none absolute inset-0">
                <div className={`${artworkFrameClass}`}>
                  <div className="absolute inset-0 rounded-[2rem] bg-[linear-gradient(135deg,rgba(196,228,185,0.16),rgba(255,255,255,0.04))]" />
                  <Image
                    src={artwork}
                    alt={artworkAlt}
                    fill
                    priority
                    className={`object-contain ${
                      isCompact
                        ? "scale-[1.08] object-center"
                        : isTablet
                          ? "scale-[1.1] object-center"
                          : "scale-[1.12] object-center"
                    }`}
                    sizes="(max-width: 767px) 100vw, (max-width: 1023px) 58vw, 48vw"
                  />
                </div>
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,28,16,0.18)_0%,rgba(18,28,16,0.08)_32%,rgba(10,12,10,0.3)_100%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(22,39,20,0.02),rgba(12,16,12,0.64)_100%)]" />
              </div>
            ) : null}

            <div className="relative z-10 flex h-full w-full flex-col justify-between">
              <div className="max-w-[34rem]">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#D5E400]/20 bg-black/14 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#F6FF6A]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#F6FF6A]" />
                  {badge}
                </span>

                <h1 className={`mt-4 font-black tracking-tight text-white/92 drop-shadow-[0_10px_24px_rgba(0,0,0,0.32)] ${isCompact ? "text-[1.75rem] leading-[1.02]" : isTablet ? "text-[2.85rem] leading-[0.96]" : "text-[3.35rem] lg:text-[3.9rem] leading-[0.92]"}`}>
                  {title}
                </h1>

                <p className={`mt-3 max-w-xl text-white/68 ${isCompact ? "text-sm leading-6" : "text-[0.98rem] sm:text-base leading-7"}`}>
                  {description}
                </p>

                {trimmedHighlights.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {trimmedHighlights.map((highlight) => (
                      <span
                        key={highlight}
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/84"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className={`max-w-[32rem] pt-7 sm:pt-9 lg:pt-10 ${isCompact ? "hidden sm:block" : ""}`}>
                <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md sm:p-6">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className={`${isCompact ? "text-4xl" : "text-[2.9rem] sm:text-[3.5rem]"} font-black tracking-tight text-white/90`}>
                        Hapus
                      </p>
                      <p className="mt-2 text-base font-semibold leading-tight text-white/74 sm:text-xl">
                        Travels & Logistics
                      </p>
                    </div>
                    <div className="hidden h-12 w-12 items-center justify-center rounded-2xl border border-[#D5E400]/22 bg-[#D5E400]/12 text-[#F6FF6A] sm:flex">
                      <Icon icon="solar:shield-check-bold-duotone" className="text-2xl" />
                    </div>
                  </div>

                  {supportLine ? (
                    <p className="mt-4 text-sm leading-6 text-white/62">
                      {supportLine}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-white/62">
                      Small screens stay focused and fast, while larger screens keep the richer brand presence.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="order-2 lg:justify-self-end lg:self-center">
          <div className={`rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(18,21,18,0.7),rgba(11,13,11,0.85))] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.4)] backdrop-blur-3xl sm:p-6 lg:p-7 ${cardWidth} ${isMobile ? "mx-auto" : ""}`}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
