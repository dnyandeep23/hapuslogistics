"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryHref?: string;
  compact?: boolean;
  className?: string;
}

/**
 * Reusable empty state component with consistent styling.
 * Used for empty orders, empty contacts, empty employee lists, etc.
 */
export default function EmptyState({
  icon = "solar:box-bold-duotone",
  title,
  description,
  hint,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryHref,
  compact = false,
  className = "",
}: EmptyStateProps) {
  const { isMobile } = useResponsiveMode();

  if (compact) {
    return (
      <div className={`rounded-2xl border border-dashed border-white/15 bg-white/[0.03] ${isMobile ? "p-3.5" : "p-4 sm:p-5"} text-center ${className}`} role="status" aria-live="polite">
        <div className={`mx-auto flex items-center justify-center rounded-xl bg-white/5 text-white/40 ${isMobile ? "h-9 w-9" : "h-10 w-10"}`}>
          <Icon icon={icon} className={isMobile ? "text-lg" : "text-xl"} />
        </div>
        <p className={`mt-3 font-medium text-white/60 ${isMobile ? "text-sm" : "text-sm"}`}>{title}</p>
        {description ? (
          <p className={`mt-1 text-white/40 ${isMobile ? "text-[11px] leading-4" : "text-xs"}`}>{description}</p>
        ) : null}
        {hint ? <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-white/28">{hint}</p> : null}
        <div className={`mt-3 flex gap-2 ${isMobile ? "flex-col" : "flex-row justify-center"}`}>
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-[#D5E400]/25 bg-[#D5E400]/10 px-3 py-1.5 text-xs font-semibold text-[#F4F8BF] transition hover:bg-[#D5E400]/15 active:scale-95 ${isMobile ? "w-full" : ""}`}
            >
              {actionLabel}
            </button>
          ) : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <button
              type="button"
              onClick={onSecondaryAction}
              className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/10 active:scale-95 ${isMobile ? "w-full" : ""}`}
            >
              {secondaryActionLabel}
            </button>
          ) : null}
          {secondaryActionLabel && secondaryHref ? (
            <Link
              href={secondaryHref}
              className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/10 active:scale-95 ${isMobile ? "w-full" : ""}`}
            >
              {secondaryActionLabel}
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/12 bg-white/[0.02] ${isMobile ? "px-4 py-9" : "px-4 py-10 sm:px-6 sm:py-12"} text-center ${className}`} role="status" aria-live="polite">
      <div className={`flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40 ${isMobile ? "h-14 w-14" : "h-16 w-16"}`}>
        <Icon icon={icon} className={isMobile ? "text-2xl" : "text-3xl"} />
      </div>
      <h3 className={`mt-5 font-semibold text-white/80 ${isMobile ? "text-base" : "text-lg"}`}>{title}</h3>
      {description ? (
        <p className={`mt-2 max-w-md leading-relaxed text-white/45 ${isMobile ? "text-sm" : "text-sm"}`}>{description}</p>
      ) : null}
      {hint ? <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-white/28">{hint}</p> : null}
      <div className={`mt-5 flex w-full gap-3 ${isMobile ? "flex-col" : "flex-row sm:w-auto sm:justify-center"}`}>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-[#D5E400]/30 bg-[#D5E400]/10 px-5 py-3 text-sm font-semibold text-[#F4F8BF] transition hover:bg-[#D5E400]/15 active:scale-95 ${isMobile ? "w-full" : ""}`}
          >
            <Icon icon="solar:arrow-right-up-linear" className="text-base" />
            {actionLabel}
          </button>
        ) : null}
        {secondaryActionLabel && onSecondaryAction ? (
          <button
            type="button"
            onClick={onSecondaryAction}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 active:scale-95 ${isMobile ? "w-full" : ""}`}
          >
            {secondaryActionLabel}
          </button>
        ) : null}
        {secondaryActionLabel && secondaryHref ? (
          <Link
            href={secondaryHref}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 active:scale-95 ${isMobile ? "w-full" : ""}`}
          >
            {secondaryActionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
