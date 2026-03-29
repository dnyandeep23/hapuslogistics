"use client";

import { useSyncExternalStore } from "react";

export const RESPONSIVE_BREAKPOINTS = {
  mobileMax: 767,
  tabletMin: 768,
  tabletMax: 1023,
  desktopMin: 1024,
} as const;

export type ResponsiveMode = "mobile" | "tablet" | "desktop";

function getViewportWidth(): number {
  if (typeof window === "undefined") return RESPONSIVE_BREAKPOINTS.desktopMin;
  return window.innerWidth;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("resize", callback);
  window.addEventListener("orientationchange", callback);

  return () => {
    window.removeEventListener("resize", callback);
    window.removeEventListener("orientationchange", callback);
  };
}

function getResponsiveMode(width: number): ResponsiveMode {
  if (width <= RESPONSIVE_BREAKPOINTS.mobileMax) return "mobile";
  if (width < RESPONSIVE_BREAKPOINTS.desktopMin) return "tablet";
  return "desktop";
}

export function useResponsiveMode() {
  const width = useSyncExternalStore(subscribe, getViewportWidth, () => RESPONSIVE_BREAKPOINTS.desktopMin);
  const mode = getResponsiveMode(width);

  return {
    width,
    mode,
    isMobile: mode === "mobile",
    isTablet: mode === "tablet",
    isDesktop: mode === "desktop",
    isHandheld: mode !== "desktop",
  };
}
