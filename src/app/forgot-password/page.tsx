"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import AuthShell from "@/components/AuthShell";
import { forgotPassword } from "@/services/auth";
import { getErrorMessage } from "@/lib/authError";
import {
  GENERIC_AUTH_ERROR_MESSAGE,
  getEmailValidationMessage,
  normalizeEmail,
} from "@/lib/authFlow";

function getRecoveryErrorMessage(error: unknown): string {
  const message = getErrorMessage(error, GENERIC_AUTH_ERROR_MESSAGE);
  const normalized = message.toLowerCase();

  if (normalized.includes("not found") || normalized.includes("no account")) {
    return "We could not find an account for that email.";
  }

  if (normalized.includes("rate") || normalized.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  return message;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean }>({});
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "warning" | "" }>({
    message: "",
    type: "",
  });
  const errors = useMemo(() => {
    const nextErrors: { email?: string } = {};

    if (submitAttempted || touched.email) {
      const emailMessage = getEmailValidationMessage(email);
      if (emailMessage) {
        nextErrors.email = emailMessage;
      }
    }

    return nextErrors;
  }, [email, submitAttempted, touched.email]);

  const isSubmitDisabled = loading || !email.trim() || Boolean(errors.email);

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    setSubmitAttempted(true);
    setTouched({ email: true });

    const normalizedEmail = normalizeEmail(email);
    const emailError = getEmailValidationMessage(normalizedEmail);
    if (emailError) return;

    setLoading(true);
    setNotification({ message: "", type: "" });

    try {
      const response = await forgotPassword(normalizedEmail);
      sessionStorage.setItem("reset-password-email", normalizedEmail);
      setNotification({
        message: response.message || "Security code sent. Redirecting you to the reset step.",
        type: "success",
      });
      window.setTimeout(() => {
        router.push("/reset-password");
      }, 550);
    } catch (error: unknown) {
      setNotification({
        message: getRecoveryErrorMessage(error),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      badge="Password recovery"
      title="Reset your password in a few secure steps"
      description="Enter the email tied to your account and we’ll send a security code so you can get back in quickly."
      supportLine="We only use this email to verify recovery and continue the reset flow."
      highlights={["Email recovery", "Security code", "Fast reset"]}
    >
      <div className="space-y-6">
        {notification.message ? (
          <div
            role="alert"
            className={`rounded-[1.4rem] border px-4 py-3.5 text-sm leading-6 ${
              notification.type === "error"
                ? "border-red-400/30 bg-red-500/10 text-red-100"
                : notification.type === "warning"
                  ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                  : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            {notification.message}
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">Account recovery</p>
              <p className="mt-2 text-3xl font-bold text-white">Forgot Password</p>
            </div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
              <span className="rounded-full bg-[#D5E400]/18 px-4 py-1.5 text-sm font-semibold text-[#F6FF6A]">
                Secure
              </span>
            </div>
          </div>
          <p className="text-sm leading-6 text-white/60">
            Enter your email and we’ll send an 8-digit security code to continue the reset flow.
          </p>
        </div>

        <form onSubmit={handleSendCode} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
              Email
            </label>
            <div
              className={`flex items-center rounded-[1.2rem] border px-4 transition-all ${
                errors.email
                  ? "border-red-500/70 bg-red-500/10"
                  : "border-white/10 bg-black/35 focus-within:border-[#D5E400]/40 focus-within:bg-black/50 focus-within:shadow-[0_0_0_4px_rgba(213,228,0,0.08)]"
              }`}
            >
              <Icon icon="solar:letter-bold-duotone" className="text-lg text-white/38" />
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setNotification({ message: "", type: "" });
                }}
                onBlur={() =>
                  setTouched((currentValue) => ({ ...currentValue, email: true }))
                }
                className="w-full bg-transparent px-3 py-4 text-base text-white placeholder:text-white/35 focus:outline-none"
                autoComplete="email"
                inputMode="email"
              />
            </div>
            <span
              className={`block text-sm text-red-400 transition-all duration-300 ${
                errors.email ? "opacity-100" : "opacity-0"
              }`}
            >
              {errors.email || " "}
            </span>
          </div>

          <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.04] p-4 text-sm leading-6 text-white/60">
            We will send the code only to the account email you enter here. If you already have the code, continue to the next step after verification.
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/login"
              className="text-sm font-semibold text-[#D5E400] transition hover:text-[#F6FF6A]"
            >
              Remembered your password?
            </Link>

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#9CB800] bg-[#D5E400]/6 px-8 py-3 text-base font-semibold text-[#F6FF6A] transition-all duration-300 hover:bg-[#D5E400] hover:text-[#17210F] hover:shadow-[0_18px_40px_-24px_rgba(213,228,0,0.8)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Icon icon="line-md:loading-loop" className="text-lg" />
                  Sending...
                </>
              ) : (
                "Send Security Code"
              )}
            </button>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}
