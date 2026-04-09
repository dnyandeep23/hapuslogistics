"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    // Check if the user has already consented or rejected
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) {
      // Small delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookieConsent", "accepted");
    setIsVisible(false);
  };

  const handleNecessaryOnly = () => {
    localStorage.setItem("cookieConsent", "necessary_only");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-100 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 animate-in fade-in slide-in-from-bottom-5 duration-500 sm:left-auto sm:right-6 sm:translate-x-0">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,26,19,0.95),rgba(15,20,14,0.98))] shadow-[0_24px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        
        {/* Glow effect */}
        <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-[#d5e400]/10 blur-2xl" />

        <div className="relative p-5 text-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d5e400]/10 text-[#d5e400]">
              <Icon icon="mdi:cookie-outline" className="text-xl" />
            </div>
            <p className="font-medium text-[#F6FF6A]">{t.cookie.title}</p>
          </div>
          
          <p className="mb-5 text-white/60 leading-relaxed text-[13px]">
            {t.cookie.description}
          </p>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleNecessaryOnly}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 px-3 text-center text-[13px] font-medium text-white/80 transition-colors hover:bg-white/10 active:scale-95"
            >
              {t.cookie.necessaryOnly}
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 rounded-xl bg-[linear-gradient(135deg,#d5e400,#8fa82f)] py-2.5 px-3 text-center text-[13px] font-bold text-[#14210d] shadow-[0_4px_12px_rgba(213,228,0,0.2)] transition-transform hover:scale-[1.02] active:scale-95"
            >
              {t.cookie.acceptAll}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
