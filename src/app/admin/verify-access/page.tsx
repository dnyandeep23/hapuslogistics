"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { resendAdminOtp, verifyAdminOtp } from "@/services/auth";
import { useRouter, useSearchParams } from "next/navigation";
import NotificationBox from "@/components/NotificationBox";
import { getErrorMessage } from "@/lib/authError";
import { useToast } from "@/context/ToastContext";
import AuthShell from "@/components/AuthShell";
import {
  GENERIC_AUTH_ERROR_MESSAGE,
  getOtpValidationMessage,
} from "@/lib/authFlow";

function AdminVerifyAccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<{ otp?: boolean }>({});
  const [notification, setNotification] = useState({
    message: "",
    type: "" as "success" | "warning" | "error" | "",
  });
  const errors = useMemo(() => {
    const nextErrors: { otp?: string } = {};

    if (submitAttempted || touched.otp) {
      const otpMessage = getOtpValidationMessage(otpCode, 6);
      if (otpMessage) {
        nextErrors.otp = otpMessage;
      }
    }

    return nextErrors;
  }, [otpCode, submitAttempted, touched.otp]);

  const isSubmitDisabled = loading || !otpCode.trim() || Boolean(errors.otp);

  useEffect(() => {
    const flow = searchParams.get("flow");
    const delivery = searchParams.get("delivery");

    if (delivery === "failed") {
      setNotification({
        message:
          "Access code email was not delivered. Click Resend Access Code to request a new code.",
        type: "warning",
      });
      return;
    }

    if (flow === "register") {
      setNotification({
        message:
          "Registration complete. Enter the admin access code sent to your email to continue.",
        type: "success",
      });
      return;
    }

    setNotification({
      message: "Enter the one-time admin access code sent to your registered email.",
      type: "success",
    });
  }, [searchParams]);

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setTouched({ otp: true });

    const otpError = getOtpValidationMessage(otpCode, 6);
    if (otpError) return;

    setLoading(true);
    setNotification({ message: "", type: "" });

    try {
      const response = (await verifyAdminOtp(otpCode)) as {
        accountDeletionCancelled?: boolean;
      };
      if (response.accountDeletionCancelled) {
        addToast("Your scheduled account deletion has been cancelled.", "success");
      }
      router.push("/dashboard");
    } catch (error: unknown) {
      setNotification({
        message: getErrorMessage(error, GENERIC_AUTH_ERROR_MESSAGE),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      const response = await resendAdminOtp();
      setNotification({
        message: response.message || "A fresh access code has been sent.",
        type: "success",
      });
    } catch (error: unknown) {
      setNotification({
        message: getErrorMessage(error, GENERIC_AUTH_ERROR_MESSAGE),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      badge="Admin verification"
      title="Confirm admin access"
      description="Use the one-time access code flow with a cleaner, icon-guided layout that works well on mobile and desktop."
      supportLine="If the code was not delivered, you can request another one without leaving this screen."
      highlights={["One-time code", "Resend access", "Protected route"]}
    >
      <div className="space-y-5 sm:space-y-6">
        <NotificationBox message={notification.message} type={notification.type} />

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
                Admin verification
              </p>
              <p className="text-[2.1rem] font-black leading-[0.92] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
                Verify access code
              </p>
              <p className="max-w-xl text-sm leading-6 text-white/62 sm:text-[1.05rem] sm:leading-7">
                Enter the 6-digit code sent to your registered email address.
              </p>
            </div>
            <div className="rounded-full border border-[#D5E400]/18 bg-[#D5E400]/10 px-4 py-3 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F6FF6A]/75">
                Secure
              </p>
              <p className="text-sm font-semibold text-[#F6FF6A]">OTP</p>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/70">
            The code screen is optimized for quick verification on smaller screens and still keeps the admin context visible on desktop.
          </div>
        </div>

        <form onSubmit={submitOtp} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
              One-time access code
            </label>
            <div
              className={`flex items-center rounded-[1rem] border px-4 transition-all ${
                errors.otp
                  ? "border-red-500/70 bg-red-500/10"
                  : "border-white/10 bg-black/35 focus-within:border-[#D5E400]/35 focus-within:bg-black/50 focus-within:shadow-[0_0_0_4px_rgba(213,228,0,0.08)]"
              }`}
            >
              <Icon icon="solar:key-bold-duotone" className="text-lg text-white/38" />
              <input
                type="text"
                placeholder="6-digit access code"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                aria-invalid={Boolean(errors.otp)}
                aria-describedby="admin-verify-access-error"
                onBlur={() =>
                  setTouched((currentValue) => ({ ...currentValue, otp: true }))
                }
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtpCode(value);
                  setNotification({ message: "", type: "" });
                }}
                className="w-full bg-transparent py-4 text-base tracking-[0.32em] text-white placeholder:text-white/35 focus:outline-none"
              />
            </div>
            <span
              id="admin-verify-access-error"
              className={`block text-sm text-red-400 transition-all duration-300 ${
                errors.otp ? "opacity-100" : "opacity-0"
              }`}
            >
              {errors.otp || " "}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/75 md:text-sm">
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-2 font-semibold text-[#F6FF6A] transition hover:text-[#fff37a]"
            >
              <Icon icon="solar:arrow-left-broken" className="text-sm" />
              Back to Admin Login
            </Link>
            <button
              type="button"
              className="inline-flex items-center gap-2 font-semibold text-[#F6FF6A] transition hover:text-[#fff37a] disabled:opacity-50"
              onClick={handleResend}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Icon icon="line-md:loading-loop" className="text-base" />
                  Please wait...
                </>
              ) : (
                "Resend Access Code"
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#D5E400] bg-transparent px-6 py-3.5 font-semibold text-[#D5E400] transition-all duration-300 hover:bg-[#D5E400] hover:text-black hover:shadow-[0_18px_40px_-24px_rgba(213,228,0,0.75)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Icon icon="line-md:loading-loop" className="text-lg" />
                Verifying...
              </>
            ) : (
              "Verify Access"
            )}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}

export default function AdminVerifyAccessPage() {
  return (
    <Suspense fallback={<section className="min-h-screen bg-[#0A0D09]" />}>
      <AdminVerifyAccessPageContent />
    </Suspense>
  );
}
