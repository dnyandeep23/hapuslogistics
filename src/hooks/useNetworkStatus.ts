"use client";

import { useSyncExternalStore } from "react";

function getOnlineStatus(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  window.addEventListener("focus", callback);
  document.addEventListener("visibilitychange", callback);
  window.addEventListener("pageshow", callback);

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
    window.removeEventListener("focus", callback);
    document.removeEventListener("visibilitychange", callback);
    window.removeEventListener("pageshow", callback);
  };
}

/**
 * Hook that tracks online/offline status using the browser's navigator.onLine.
 * Returns `true` when online, `false` when offline.
 * SSR-safe: always returns `true` on the server.
 */
export function useNetworkStatus(): boolean {
  return useSyncExternalStore(subscribe, getOnlineStatus, () => true);
}
