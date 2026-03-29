// src/components/NotificationBox.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

interface NotificationBoxProps {
  message: string;
  type: "success" | "warning" | "error" | "";
  showResend?: boolean;
  onResend?: () => void;
}

const NotificationBox = ({
  message,
  type,
  showResend = false,
  onResend,
}: NotificationBoxProps) => {
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;

    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  if (!message || !type) return null;

  const variants = {
    success: {
      title: "Success",
      icon: "solar:check-circle-bold-duotone",
      wrapper: "border-emerald-500/20 bg-[linear-gradient(145deg,rgba(16,34,23,0.9),rgba(10,18,12,0.96))]",
      accent: "bg-emerald-400/10 text-emerald-200",
      text: "text-emerald-100/90",
      button: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15",
    },
    warning: {
      title: "Action needed",
      icon: "solar:danger-triangle-bold-duotone",
      wrapper: "border-amber-400/20 bg-[linear-gradient(145deg,rgba(33,26,11,0.92),rgba(18,16,10,0.96))]",
      accent: "bg-amber-400/10 text-amber-100",
      text: "text-amber-50/90",
      button: "border-amber-300/20 bg-amber-300/10 text-amber-50 hover:bg-amber-300/15",
    },
    error: {
      title: "Something went wrong",
      icon: "solar:shield-warning-bold-duotone",
      wrapper: "border-rose-400/20 bg-[linear-gradient(145deg,rgba(35,16,20,0.95),rgba(17,10,12,0.98))]",
      accent: "bg-rose-400/10 text-rose-100",
      text: "text-rose-100/90",
      button: "border-rose-300/20 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15",
    },
  };

  const variant = variants[type];

  const handleResendClick = () => {
    if (cooldown === 0 && onResend) {
      onResend();
      setCooldown(2);
    }
  };

  return (
    <div
      className={`overflow-hidden rounded-[1.5rem] border shadow-[0_20px_50px_-28px_rgba(0,0,0,0.55)] backdrop-blur-xl ${variant.wrapper}`}
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <div className="grid gap-3 p-4 sm:grid-cols-[auto,minmax(0,1fr),auto] sm:items-start sm:gap-4 sm:p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${variant.accent}`}>
          <Icon icon={variant.icon} className="text-xl" />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
            {variant.title}
          </p>
          <p className={`mt-1 whitespace-pre-line text-sm leading-6 ${variant.text}`}>
            {message}
          </p>
        </div>

        {showResend ? (
          <button
            type="button"
            onClick={handleResendClick}
            disabled={cooldown > 0}
            className={`inline-flex w-full shrink-0 items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${variant.button}`}
            aria-label={
              cooldown > 0
                ? `Resend code available in ${cooldown} seconds`
                : "Resend verification code"
            }
          >
            {cooldown > 0 ? `Wait ${cooldown}s` : "Resend code"}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default NotificationBox;
