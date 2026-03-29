"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

type TrackerMode = "dashboard" | "homepage";

type TrackedOrder = {
  id: string;
  trackingId: string;
  status: string;
  orderDate: string;
  pickupLocation: {
    name: string;
    city: string;
    state: string;
  };
  dropLocation: {
    name: string;
    city: string;
    state: string;
  };
  packageCount: number;
};

type ErrorResponse = {
  message?: string;
  error?: string;
};

interface OrderTrackingWidgetProps {
  mode: TrackerMode;
  className?: string;
}

const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;
const TRACKING_ID_PATTERN = /^HAP-[A-Z0-9]{8}$/;

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusClasses(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "delivered") return "border-green-500/40 bg-green-500/15 text-green-200";
  if (normalized === "in-transit") return "border-blue-500/40 bg-blue-500/15 text-blue-200";
  if (normalized === "missed_package") return "border-orange-500/40 bg-orange-500/15 text-orange-200";
  if (normalized === "cancelled") return "border-red-500/40 bg-red-500/15 text-red-200";
  return "border-amber-500/40 bg-amber-500/15 text-amber-200";
}

function normalizeIdentifierInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const normalized = trimmed.toUpperCase().replace(/\s+/g, "");
  if (normalized.startsWith("HAP")) {
    const suffix = normalized
      .slice(3)
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
    return `HAP-${suffix}`;
  }

  return trimmed;
}

export default function OrderTrackingWidget({ mode, className = "" }: OrderTrackingWidgetProps) {
  const router = useRouter();
  const { isMobile, isTablet, isDesktop } = useResponsiveMode();
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [requestingCode, setRequestingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [trackingFromDashboard, setTrackingFromDashboard] = useState(false);
  const [codeRequested, setCodeRequested] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [trackedOrder, setTrackedOrder] = useState<TrackedOrder | null>(null);

  const isBusy = requestingCode || verifyingCode || trackingFromDashboard;
  const normalizedIdentifier = identifier.trim();
  const identifierNeedsTrackingFormat = useMemo(() => {
    const normalized = normalizedIdentifier.toUpperCase();
    if (!normalized.startsWith("HAP")) return false;
    return !TRACKING_ID_PATTERN.test(normalized);
  }, [normalizedIdentifier]);

  const cardTitle = useMemo(
    () =>
      mode === "dashboard"
        ? isMobile
          ? "Track order"
          : "Track Your Order"
        : isMobile
          ? "Quick track"
          : "Track Order Without Login",
    [isMobile, mode],
  );

  const cardSubtitle = useMemo(() => {
    if (mode === "dashboard") {
      if (isMobile) return "Use an order or tracking ID to jump into your shipment.";
      if (isTablet) return "Enter Order ID or Tracking ID. Only your account orders can be opened from here.";
      return "Enter Order ID or Tracking ID. Only your account orders can be opened.";
    }
    if (isMobile) return "Add the booking email and we will verify it with a quick code.";
    if (isTablet) return "Enter Order ID/Tracking ID and the booking email. We will send a verification code.";
    return "Enter Order ID/Tracking ID and the booking email. We will send a verification code.";
  }, [isMobile, isTablet, mode]);

  const helperChips = useMemo(
    () =>
      mode === "dashboard"
        ? [
            isMobile ? "Fast account lookup" : "Account-secured lookup",
            isDesktop ? "Full order workspace" : "Touch-friendly flow",
          ]
        : [
            "Email verification",
            isMobile ? "Compact mobile tracking" : isTablet ? "Balanced tracking flow" : "Detailed order snapshot",
          ],
    [isDesktop, isMobile, isTablet, mode],
  );

  const resetFeedback = () => {
    setMessage("");
    setError("");
  };

  const parseResponse = async (
    response: Response,
  ): Promise<ErrorResponse & { order?: TrackedOrder }> => {
    try {
      return (await response.json()) as ErrorResponse & { order?: TrackedOrder };
    } catch {
      return {};
    }
  };

  const validateIdentifier = (): string | null => {
    if (!normalizedIdentifier) {
      return "Order ID or Tracking ID is required.";
    }

    const uppercaseValue = normalizedIdentifier.toUpperCase();
    if (uppercaseValue.startsWith("HAP") && !TRACKING_ID_PATTERN.test(uppercaseValue)) {
      return "Tracking ID format must be HAP-XXXXXXXX.";
    }

    if (!uppercaseValue.startsWith("HAP") && !OBJECT_ID_PATTERN.test(normalizedIdentifier)) {
      return null;
    }

    return null;
  };

  const handleDashboardTrack = async () => {
    resetFeedback();
    setTrackedOrder(null);

    const identifierError = validateIdentifier();
    if (identifierError) {
      setError(identifierError);
      return;
    }

    try {
      setTrackingFromDashboard(true);
      const response = await fetch("/api/orders/track/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: normalizedIdentifier }),
      });
      const payload = await parseResponse(response);
      if (!response.ok) {
        setError(payload.message || payload.error || "Unable to track this order.");
        return;
      }

      const orderId = payload.order?.id;
      if (!orderId) {
        setError("Order details are missing.");
        return;
      }

      router.push(`/dashboard/orders/${encodeURIComponent(orderId)}`);
    } finally {
      setTrackingFromDashboard(false);
    }
  };

  const handleRequestCode = async () => {
    resetFeedback();
    setTrackedOrder(null);

    const identifierError = validateIdentifier();
    if (identifierError) {
      setError(identifierError);
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    try {
      setRequestingCode(true);
      const response = await fetch("/api/orders/track/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: normalizedIdentifier,
          email: email.trim(),
        }),
      });
      const payload = await parseResponse(response);
      if (!response.ok) {
        setError(payload.message || payload.error || "Unable to send verification code.");
        return;
      }

      setCodeRequested(true);
      setMessage(payload.message || "Verification code sent to your email.");
    } finally {
      setRequestingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    resetFeedback();

    if (!code.trim()) {
      setError("Verification code is required.");
      return;
    }

    try {
      setVerifyingCode(true);
      const response = await fetch("/api/orders/track/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: normalizedIdentifier,
          email: email.trim(),
          code: code.trim(),
        }),
      });
      const payload = await parseResponse(response);
      if (!response.ok) {
        setError(payload.message || payload.error || "Unable to verify code.");
        return;
      }

      if (!payload.order?.id) {
        setError("Order details are missing.");
        return;
      }

      setTrackedOrder(payload.order);
      setMessage(payload.message || "Order verified successfully.");
    } finally {
      setVerifyingCode(false);
    }
  };

  return (
    <div className={`border border-white/10 bg-[linear-gradient(145deg,rgba(20,26,20,0.8),rgba(10,14,10,0.95))] shadow-2xl backdrop-blur-xl transition-all ${isMobile ? "rounded-[1.75rem] p-4" : isTablet ? "rounded-[1.9rem] p-5" : "rounded-[2rem] p-6"} ${className}`}>
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#D5E400]/20 to-[#E4E67A]/5 border border-[#D5E400]/20 text-[#D5E400] shadow-[0_0_15px_rgba(213,228,0,0.1)] ${isMobile ? "h-11 w-11" : "h-10 w-10"}`}>
          <Icon icon="solar:routing-2-bold-duotone" className="text-xl drop-shadow-[0_2px_4px_rgba(213,228,0,0.3)]" />
        </div>
        <div>
          <h3 className={`font-bold tracking-wide text-white ${isMobile ? "text-base" : "text-lg"}`}>{cardTitle}</h3>
        </div>
      </div>
      <p className={`mt-3 leading-relaxed text-white/60 ${isMobile ? "text-[13px]" : "text-sm"}`}>{cardSubtitle}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {helperChips.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/70"
          >
            <Icon icon="mdi:check-decagram-outline" className="text-sm text-[#D5E400]" />
            {chip}
          </span>
        ))}
      </div>

      <div className={`grid gap-4 ${isMobile ? "mt-5" : "mt-6"}`}>
        <input
          value={identifier}
          onChange={(event) => setIdentifier(normalizeIdentifierInput(event.target.value))}
          placeholder="Order ID or HAP-XXXXXXXX"
          className={`w-full rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent px-4 text-sm text-white outline-none transition-all duration-300 focus:border-[#D5E400]/50 focus:bg-white/[0.04] focus:shadow-[0_0_20px_rgba(213,228,0,0.1)] ${isMobile ? "py-3" : "py-3.5"}`}
        />
        <p className={`text-xs ${identifierNeedsTrackingFormat ? "text-amber-200" : "text-white/55"}`}>
          Tracking format: HAP-XXXXXXXX. Hyphen is added automatically.
        </p>

        {mode === "homepage" && (
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Booking email address"
            className={`w-full rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent px-4 text-sm text-white outline-none transition-all duration-300 focus:border-[#D5E400]/50 focus:bg-white/[0.04] focus:shadow-[0_0_20px_rgba(213,228,0,0.1)] ${isMobile ? "py-3" : "py-3.5"}`}
          />
        )}
      </div>

      {mode === "dashboard" ? (
        <button
          type="button"
          onClick={handleDashboardTrack}
          disabled={isBusy}
          className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D5E400] to-[#E4E67A] px-4 text-sm font-bold tracking-wide text-black transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 shadow-[0_10px_30px_rgba(213,228,0,0.2)] ${isMobile ? "py-3" : "py-3.5"}`}
        >
          <Icon icon={trackingFromDashboard ? "line-md:loading-loop" : "mdi:magnify"} />
          {trackingFromDashboard ? "Checking..." : "Track Order"}
        </button>
      ) : (
        <div className={`mt-4 ${isMobile ? "grid gap-3" : "flex flex-wrap gap-3"}`}>
          <button
            type="button"
            onClick={handleRequestCode}
            disabled={isBusy}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D5E400] to-[#E4E67A] px-4 text-sm font-bold tracking-wide text-black transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 shadow-[0_10px_30px_rgba(213,228,0,0.2)] ${isMobile ? "w-full py-3" : "flex-1 py-3.5"}`}
          >
            <Icon icon={requestingCode ? "line-md:loading-loop" : "mdi:email-send-outline"} />
            {requestingCode ? "Sending..." : "Send Code"}
          </button>

          {codeRequested && (
            <div className={`gap-3 ${isMobile ? "grid" : "contents"}`}>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="6-digit code"
                className={`rounded-2xl border border-white/10 bg-black/40 px-4 text-center text-sm tracking-widest text-white outline-none transition-all duration-300 focus:border-[#D5E400]/50 focus:bg-black/60 focus:shadow-[0_0_20px_rgba(213,228,0,0.1)] ${isMobile ? "w-full py-3" : "w-32 flex-shrink-0 py-3.5"}`}
              />
              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={isBusy}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-400/30 bg-gradient-to-r from-blue-500/10 to-blue-500/20 px-4 text-sm font-bold text-blue-300 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 shadow-[0_5px_15px_rgba(59,130,246,0.15)] ${isMobile ? "w-full py-3" : "flex-1 py-3.5"}`}
              >
                <Icon icon={verifyingCode ? "line-md:loading-loop" : "mdi:shield-check-outline"} />
                {verifyingCode ? "Verifying..." : "Verify & Track"}
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-4 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-200">
          {message}
        </div>
      )}

      {mode === "homepage" && trackedOrder && (
        <div className={`mt-4 border border-white/20 bg-black/25 ${isMobile ? "rounded-[1.25rem] p-3.5" : "rounded-xl p-4"}`}>
          <div className={`flex gap-2 ${isMobile ? "flex-col items-start" : "items-center justify-between"}`}>
            <p className="font-mono text-sm text-[#F6FF6A]">{trackedOrder.trackingId}</p>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusClasses(trackedOrder.status)}`}
            >
              {trackedOrder.status}
            </span>
          </div>
          <p className="mt-2 text-xs text-white/70">Order date: {formatDate(trackedOrder.orderDate)}</p>
          <p className="mt-2 text-sm text-white">
            {trackedOrder.pickupLocation.name || "Pickup"} to {trackedOrder.dropLocation.name || "Drop"}
          </p>
          <div className={`mt-3 grid gap-2 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Packages</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {trackedOrder.packageCount} package{trackedOrder.packageCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Destination</p>
              <p className="mt-1 text-sm font-semibold text-white">{trackedOrder.dropLocation.city || "--"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
