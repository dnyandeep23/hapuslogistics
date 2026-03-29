"use client";

import { Icon } from "@iconify/react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

/**
 * Fixed banner that slides in when the user goes offline.
 * Auto-dismisses when connection is restored.
 */
export default function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const { isMobile } = useResponsiveMode();

  if (isOnline) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] animate-slideDown pointer-events-none" role="status" aria-live="polite">
      <div className={`mx-auto max-w-2xl ${isMobile ? "px-2" : "px-3"} pt-[max(0.75rem,env(safe-area-inset-top))]`}>
        <div className={`pointer-events-auto flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-[linear-gradient(135deg,rgba(40,35,15,0.95),rgba(30,25,10,0.98))] shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl ${isMobile ? "px-3 py-3" : "px-4 py-3"}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
            <Icon icon="solar:cloud-cross-bold-duotone" className="text-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`font-semibold text-amber-100 ${isMobile ? "text-sm" : "text-sm"}`}>Connection lost</p>
            <p className={`mt-0.5 text-amber-200/70 ${isMobile ? "text-[11px] leading-4" : "text-xs"}`}>
              We’ll keep the app usable and reconnect automatically when the network returns.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={`shrink-0 rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/20 ${isMobile ? "whitespace-nowrap" : ""}`}
          >
            Try again
          </button>
          <div className="shrink-0">
            <Icon icon="line-md:loading-twotone-loop" className="text-lg text-amber-300/60" />
          </div>
        </div>
      </div>
    </div>
  );
}
