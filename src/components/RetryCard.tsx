"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

interface RetryCardProps {
  error: string;
  onRetry?: () => void;
  retrying?: boolean;
  title?: string;
  hint?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryHref?: string;
  compact?: boolean;
  className?: string;
}

/**
 * Reusable error display card with retry button.
 * Used across all data-fetching components when API calls fail.
 */
export default function RetryCard({
  error,
  onRetry,
  retrying = false,
  title = "Something went wrong",
  hint,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryHref,
  compact = false,
  className = "",
}: RetryCardProps) {
  const { isMobile } = useResponsiveMode();

  if (compact) {
    return (
      <div className={`rounded-2xl border border-rose-500/20 bg-rose-500/8 ${isMobile ? "p-3" : "p-3.5"} ${className}`} role="alert" aria-live="polite">
        <div className={`flex gap-3 ${isMobile ? "flex-col" : "items-center"}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
            <Icon icon="solar:danger-circle-bold-duotone" className={isMobile ? "text-base" : "text-lg"} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-rose-100/95">{error}</p>
            {hint ? <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-rose-200/50">{hint}</p> : null}
          </div>
          <div className={`flex gap-2 ${isMobile ? "flex-col" : "flex-row"}`}>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className={`shrink-0 rounded-xl border border-rose-400/25 bg-rose-500/12 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 active:scale-95 disabled:opacity-50 ${isMobile ? "w-full" : ""}`}
              >
                {retrying ? <Icon icon="line-md:loading-loop" className="text-sm" /> : "Retry"}
              </button>
            ) : null}
            {secondaryActionLabel && onSecondaryAction ? (
              <button
                type="button"
                onClick={onSecondaryAction}
                className={`shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 active:scale-95 ${isMobile ? "w-full" : ""}`}
              >
                {secondaryActionLabel}
              </button>
            ) : null}
            {secondaryActionLabel && secondaryHref ? (
              <Link
                href={secondaryHref}
                className={`shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 active:scale-95 ${isMobile ? "w-full text-center" : ""}`}
              >
                {secondaryActionLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-[1.75rem] border border-rose-500/20 bg-[linear-gradient(145deg,rgba(40,18,18,0.7),rgba(20,10,10,0.85))] ${isMobile ? "p-5" : "p-5 sm:p-6"} text-center ${className}`} role="alert" aria-live="polite">
      <div className={`mx-auto flex items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/12 text-rose-300 ${isMobile ? "h-12 w-12" : "h-14 w-14"}`}>
        <Icon icon="solar:shield-warning-bold-duotone" className={isMobile ? "text-xl" : "text-2xl"} />
      </div>
      <h3 className={`mt-4 font-semibold text-rose-100 ${isMobile ? "text-base" : "text-lg"}`}>{title}</h3>
      <p className={`mt-2 leading-relaxed text-rose-200/70 ${isMobile ? "text-sm" : "text-sm"}`}>{error}</p>
      {hint ? <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-rose-200/45">{hint}</p> : null}
      {onRetry ? (
        <div className={`mt-5 flex gap-3 ${isMobile ? "flex-col" : "flex-row justify-center"}`}>
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/15 px-5 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 active:scale-95 disabled:opacity-50 ${isMobile ? "w-full" : ""}`}
          >
            <Icon icon={retrying ? "line-md:loading-loop" : "solar:restart-bold-duotone"} className="text-base" />
            {retrying ? "Retrying..." : "Try Again"}
          </button>
          {secondaryActionLabel && onSecondaryAction ? (
            <button
              type="button"
              onClick={onSecondaryAction}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 active:scale-95 ${isMobile ? "w-full" : ""}`}
            >
              {secondaryActionLabel}
            </button>
          ) : null}
          {secondaryActionLabel && secondaryHref ? (
            <Link
              href={secondaryHref}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 active:scale-95 ${isMobile ? "w-full" : ""}`}
            >
              {secondaryActionLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
      {!onRetry && secondaryActionLabel && (onSecondaryAction || secondaryHref) ? (
        <div className="mt-5">
          {onSecondaryAction ? (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 active:scale-95"
            >
              {secondaryActionLabel}
            </button>
          ) : null}
          {secondaryHref ? (
            <Link
              href={secondaryHref}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 active:scale-95"
            >
              {secondaryActionLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
