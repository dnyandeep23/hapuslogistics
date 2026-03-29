"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import AuthShell from "@/components/AuthShell";
import { forgotPassword, resetPassword } from "@/services/auth";
import { getErrorMessage } from "@/lib/authError";
import {
  GENERIC_AUTH_ERROR_MESSAGE,
  getConfirmPasswordValidationMessage,
  getPasswordValidationMessage,
  normalizeEmail,
} from "@/lib/authFlow";

const CODE_LENGTH = 8;
const RESEND_TIMEOUT = 60;

function getFriendlyRecoveryError(error: unknown, fallback = "Something went wrong, please try again.") {
  const message = getErrorMessage(error, fallback);
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid") && normalized.includes("code")) {
    return "The security code is invalid or expired.";
  }

  if (normalized.includes("expired")) {
    return "That security code has expired. Request a new one.";
  }

  if (normalized.includes("password") && normalized.includes("match")) {
    return "Passwords do not match.";
  }

  if (normalized.includes("not found")) {
    return "We could not verify that account.";
  }

  return message;
}

function getSecurityCodeValidationMessage(code: string): string | null {
  return /^\d{8}$/.test(code) ? null : "Enter the 8-digit security code from your email.";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const resendTimerRef = useRef<number | null>(null);
  const redirectTimerRef = useRef<number | null>(null);
  const [email, setEmail] = useState("");
  const [sessionChecking, setSessionChecking] = useState(true);
  const [securityCode, setSecurityCode] = useState<string[]>(Array.from({ length: CODE_LENGTH }, () => ""));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_TIMEOUT);
  const [isResendDisabled, setIsResendDisabled] = useState(true);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<{
    securityCode?: boolean;
    password?: boolean;
    confirmPassword?: boolean;
  }>({});
  const [notification, setNotification] = useState<{ message: string; type: "success" | "warning" | "error" | "" }>({
    message: "",
    type: "",
  });

  useEffect(() => {
    const resetEmail = sessionStorage.getItem("reset-password-email");
    if (!resetEmail) {
      router.replace("/forgot-password");
      return;
    }

    setEmail(resetEmail);
    setNotification({
      message: `We loaded your recovery email: ${resetEmail}.`,
      type: "success",
    });
    setSessionChecking(false);
  }, [router]);

  useEffect(() => {
    if (!isResendDisabled) return;

    resendTimerRef.current = window.setInterval(() => {
      setResendTimer((current) => {
        if (current <= 1) {
          if (resendTimerRef.current) {
            window.clearInterval(resendTimerRef.current);
            resendTimerRef.current = null;
          }
          setIsResendDisabled(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => {
      if (resendTimerRef.current) {
        window.clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
    };
  }, [isResendDisabled]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
      if (resendTimerRef.current) {
        window.clearInterval(resendTimerRef.current);
      }
    };
  }, []);

  const codeValue = securityCode.join("");
  const errors = useMemo(() => {
    const nextErrors: {
      securityCode?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (submitAttempted || touched.securityCode) {
      const securityCodeMessage = getSecurityCodeValidationMessage(codeValue);
      if (securityCodeMessage) {
        nextErrors.securityCode = securityCodeMessage;
      }
    }

    if (submitAttempted || touched.password) {
      const passwordMessage = getPasswordValidationMessage(password);
      if (passwordMessage) {
        nextErrors.password = passwordMessage;
      }
    }

    if (submitAttempted || touched.confirmPassword) {
      const confirmPasswordMessage = getConfirmPasswordValidationMessage(
        password,
        confirmPassword,
        { requiredMessage: "Confirm your new password" },
      );
      if (confirmPasswordMessage) {
        nextErrors.confirmPassword = confirmPasswordMessage;
      }
    }

    return nextErrors;
  }, [
    codeValue,
    confirmPassword,
    password,
    submitAttempted,
    touched.confirmPassword,
    touched.password,
    touched.securityCode,
  ]);

  const isSubmitDisabled =
    loading ||
    securityCode.some((digit) => !digit) ||
    !password.trim() ||
    !confirmPassword.trim() ||
    Boolean(errors.securityCode || errors.password || errors.confirmPassword);

  const updateCodeDigit = (index: number, value: string) => {
    if (/[^0-9]/.test(value)) return;

    const nextValue = [...securityCode];
    nextValue[index] = value.slice(-1);
    setSecurityCode(nextValue);
    setNotification({ message: "", type: "" });

    if (nextValue[index] && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pastedDigits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pastedDigits) return;

    const nextValue = Array.from({ length: CODE_LENGTH }, (_, index) => pastedDigits[index] || "");
    setSecurityCode(nextValue);
    setTouched((current) => ({ ...current, securityCode: true }));
    setNotification({ message: "", type: "" });

    const nextIndex = Math.min(pastedDigits.length, CODE_LENGTH - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleBackspace = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === "Backspace" && !securityCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendCode = async () => {
    if (!email || resending || isResendDisabled) return;

    setResending(true);
    setNotification({ message: "", type: "" });

    try {
      const response = await forgotPassword(email);
      setNotification({
        message: response.message || "A new security code was sent.",
        type: "success",
      });
      setResendTimer(RESEND_TIMEOUT);
      setIsResendDisabled(true);
    } catch (error: unknown) {
      setNotification({
        message: getFriendlyRecoveryError(error, "Failed to resend security code."),
        type: "error",
      });
    } finally {
      setResending(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    setSubmitAttempted(true);
    setTouched({
      securityCode: true,
      password: true,
      confirmPassword: true,
    });

    const securityCodeError = getSecurityCodeValidationMessage(codeValue);
    const passwordError = getPasswordValidationMessage(password);
    const confirmPasswordError = getConfirmPasswordValidationMessage(
      password,
      confirmPassword,
      { requiredMessage: "Confirm your new password" },
    );

    if (securityCodeError || passwordError || confirmPasswordError) return;

    setLoading(true);
    setNotification({ message: "", type: "" });

    try {
      const response = await resetPassword({
        email: normalizeEmail(email),
        securityCode: codeValue,
        password,
      });

      sessionStorage.removeItem("reset-password-email");
      setNotification({
        message: response.message || "Password reset successful. Redirecting to login...",
        type: "success",
      });

      redirectTimerRef.current = window.setTimeout(() => {
        router.push("/login");
      }, 850);
    } catch (error: unknown) {
      setNotification({
        message: getFriendlyRecoveryError(error, GENERIC_AUTH_ERROR_MESSAGE),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  if (sessionChecking) {
    return (
      <AuthShell
        badge="Password recovery"
        title="Preparing your reset screen"
        description="We are checking the recovery session and loading the secure reset form."
        supportLine="If the browser session has expired, restart recovery from the forgot-password page."
        highlights={["Session check", "Secure reset", "Verification code"]}
      >
        <div className="space-y-4">
          <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-white/70">
            <div className="flex items-center gap-3">
              <Icon icon="line-md:loading-loop" className="text-xl text-[#F6FF6A]" />
              <div>
                <p className="font-semibold text-white">Loading reset session</p>
                <p className="mt-1 text-white/60">
                  We are checking your recovery email and preparing the password reset form.
                </p>
              </div>
            </div>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      badge="Password recovery"
      title="Set a new password securely"
      description="Use the security code from your email, create a stronger password, and complete the reset without leaving this screen."
      supportLine="The code is tied to the recovery email loaded from the previous step."
      highlights={["Security code", "New password", "Quick recovery"]}
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">Secure recovery</p>
              <p className="mt-2 text-3xl font-bold text-white">Reset Password</p>
            </div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
              <span className="rounded-full bg-[#D5E400]/18 px-4 py-1.5 text-sm font-semibold text-[#F6FF6A]">
                Private
              </span>
            </div>
          </div>
          <p className="text-sm leading-6 text-white/60">Use the 8-digit code we sent to {email}.</p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
              Security code
            </label>
            <div
              className="grid grid-cols-4 gap-2 sm:grid-cols-8"
              onPaste={handlePaste}
            >
              {securityCode.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputRefs.current[index] = element;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(event) => {
                    updateCodeDigit(index, event.target.value);
                    setTouched((current) => ({ ...current, securityCode: true }));
                  }}
                  onKeyDown={(event) => handleBackspace(event, index)}
                  onBlur={() =>
                    setTouched((current) => ({ ...current, securityCode: true }))
                  }
                  placeholder="0"
                  aria-label={`Security code digit ${index + 1}`}
                  className={`h-12 rounded-[1rem] border bg-black/35 text-center text-lg font-semibold text-white transition-all focus:outline-none ${
                    errors.securityCode
                      ? "border-red-500/70"
                      : "border-white/10 focus:border-[#D5E400]/40 focus:bg-black/50 focus:shadow-[0_0_0_4px_rgba(213,228,0,0.08)]"
                  }`}
                />
              ))}
            </div>
            <span
              className={`block text-sm text-red-400 transition-all duration-300 ${
                errors.securityCode ? "opacity-100" : "opacity-0"
              }`}
            >
              {errors.securityCode || " "}
            </span>
          </div>

          <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.04] p-4 text-sm leading-6 text-white/60">
            Paste the full 8-digit code if you copied it from your email. The form will spread the digits automatically.
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
              New password
            </label>
            <div
              className={`flex items-center rounded-[1.2rem] border px-4 transition-all ${
                errors.password
                  ? "border-red-500/70 bg-red-500/10"
                  : "border-white/10 bg-black/35 focus-within:border-[#D5E400]/40 focus-within:bg-black/50 focus-within:shadow-[0_0_0_4px_rgba(213,228,0,0.08)]"
              }`}
            >
              <Icon icon="solar:lock-password-bold-duotone" className="text-lg text-white/38" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Create a new password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setNotification({ message: "", type: "" });
                }}
                onBlur={() =>
                  setTouched((current) => ({ ...current, password: true }))
                }
                className="w-full bg-transparent px-3 py-4 text-base text-white placeholder:text-white/35 focus:outline-none"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="text-white/50 transition hover:text-white"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <Icon icon={showPassword ? "ri:eye-close-fill" : "streamline:eye-optic-remix"} width={18} />
              </button>
            </div>
            <span
              className={`block text-sm text-red-400 transition-all duration-300 ${
                errors.password ? "opacity-100" : "opacity-0"
              }`}
            >
              {errors.password || " "}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
              Confirm password
            </label>
            <div
              className={`flex items-center rounded-[1.2rem] border px-4 transition-all ${
                errors.confirmPassword
                  ? "border-red-500/70 bg-red-500/10"
                  : "border-white/10 bg-black/35 focus-within:border-[#D5E400]/40 focus-within:bg-black/50 focus-within:shadow-[0_0_0_4px_rgba(213,228,0,0.08)]"
              }`}
            >
              <Icon icon="solar:shield-keyhole-bold-duotone" className="text-lg text-white/38" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setNotification({ message: "", type: "" });
                }}
                onBlur={() =>
                  setTouched((current) => ({ ...current, confirmPassword: true }))
                }
                className="w-full bg-transparent px-3 py-4 text-base text-white placeholder:text-white/35 focus:outline-none"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="text-white/50 transition hover:text-white"
                onClick={() => setShowConfirmPassword((value) => !value)}
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                <Icon icon={showConfirmPassword ? "ri:eye-close-fill" : "streamline:eye-optic-remix"} width={18} />
              </button>
            </div>
            <span
              className={`block text-sm text-red-400 transition-all duration-300 ${
                errors.confirmPassword ? "opacity-100" : "opacity-0"
              }`}
            >
              {errors.confirmPassword || " "}
            </span>
          </div>

          <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.04] p-4 text-sm leading-6 text-white/60">
            Password tip: use at least 6 characters. 8+ with numbers or symbols is stronger.
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-white/70">
              {isResendDisabled ? (
                <span>Resend code in {resendTimer}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resending}
                  className="inline-flex items-center gap-2 font-semibold text-[#D5E400] transition hover:text-[#F6FF6A] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resending ? (
                    <>
                      <Icon icon="line-md:loading-loop" className="text-base" />
                      Sending new code...
                    </>
                  ) : (
                    "Resend security code"
                  )}
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#9CB800] bg-[#D5E400]/6 px-8 py-3 text-base font-semibold text-[#F6FF6A] transition-all duration-300 hover:bg-[#D5E400] hover:text-[#17210F] hover:shadow-[0_18px_40px_-24px_rgba(213,228,0,0.8)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Icon icon="line-md:loading-loop" className="text-lg" />
                  Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-white/72">
            <span>
              Need a fresh recovery email?{" "}
              <Link href="/forgot-password" className="font-semibold text-[#D5E400] transition hover:text-[#F6FF6A]">
                Restart recovery
              </Link>
            </span>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}
