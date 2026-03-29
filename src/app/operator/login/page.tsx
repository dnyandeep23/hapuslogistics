"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { useRouter, useSearchParams } from "next/navigation";
import googleVector from "@/assets/images/googleVector.png";
import loginVector from "@/assets/images/loginvector.png";
import AuthShell from "@/components/AuthShell";
import NotificationBox from "@/components/NotificationBox";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage, normalizeAuthQueryError } from "@/lib/authError";
import {
  GENERIC_AUTH_ERROR_MESSAGE,
  getEmailValidationMessage,
  getPasswordValidationMessage,
  normalizeEmail,
} from "@/lib/authFlow";
import { loginUser, resendVerificationEmail } from "@/services/auth";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>(
    {},
  );
  const [notification, setNotification] = useState({
    message: "",
    type: "" as "success" | "warning" | "error" | "",
    showResend: false,
  });
  const role = "operator" as const;

  const errors = useMemo(() => {
    const nextErrors: { email?: string; password?: string } = {};

    if (submitAttempted || touched.email) {
      const emailMessage = getEmailValidationMessage(email);
      if (emailMessage) {
        nextErrors.email = emailMessage;
      }
    }

    if (submitAttempted || touched.password) {
      const passwordMessage = getPasswordValidationMessage(password);
      if (passwordMessage) {
        nextErrors.password = passwordMessage;
      }
    }

    return nextErrors;
  }, [email, password, submitAttempted, touched.email, touched.password]);

  const isSubmitDisabled =
    loading ||
    !email.trim() ||
    !password.trim() ||
    Boolean(errors.email || errors.password);

  useEffect(() => {
    const registered = searchParams.get("registered");
    const error = searchParams.get("error");
    const deletionScheduled = searchParams.get("deletionScheduled");
    const accountDeleted = searchParams.get("accountDeleted");

    if (registered === "true") {
      addToast(
        "Registration successful! Please check your email to verify your account.",
        "success",
      );
    }

    if (error) {
      setNotification({
        message: normalizeAuthQueryError(error),
        type: "error",
        showResend: false,
      });
      return;
    }

    if (deletionScheduled === "true") {
      setNotification({
        message: "Account deletion scheduled. Log in within 3 days to cancel it.",
        type: "warning",
        showResend: false,
      });
      return;
    }

    if (accountDeleted === "true") {
      setNotification({
        message: "Your operator account was deleted after leaving the company.",
        type: "success",
        showResend: false,
      });
    }
  }, [searchParams, addToast]);

  const handleResend = async () => {
    const normalizedEmail = normalizeEmail(email);
    const emailError = getEmailValidationMessage(normalizedEmail);

    if (emailError) {
      setTouched((currentValue) => ({ ...currentValue, email: true }));
      setSubmitAttempted(true);
      return;
    }

    try {
      const response = await resendVerificationEmail(normalizedEmail);
      addToast(
        response.message || "Verification email sent successfully.",
        "success",
      );
    } catch (error: unknown) {
      addToast(
        getErrorMessage(error, "Failed to resend verification email."),
        "error",
      );
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setSubmitAttempted(true);
    setTouched({ email: true, password: true });

    const normalizedEmail = normalizeEmail(email);
    const emailError = getEmailValidationMessage(normalizedEmail);
    const passwordError = getPasswordValidationMessage(password);

    if (emailError || passwordError) return;

    setLoading(true);
    setNotification({ message: "", type: "", showResend: false });

    try {
      const response = (await loginUser({
        email: normalizedEmail,
        password,
        role,
      })) as {
        accountDeletionCancelled?: boolean;
        requirePasswordChange?: boolean;
      };

      if (response.accountDeletionCancelled) {
        addToast("Your scheduled account deletion has been cancelled.", "success");
      }

      if (response.requirePasswordChange) {
        addToast("Update your temporary password before continuing.", "warning");
        router.push("/dashboard/profile?forcePasswordChange=true");
        return;
      }

      router.push("/dashboard");
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, GENERIC_AUTH_ERROR_MESSAGE);

      if (errorMessage.includes("Account not verified")) {
        setNotification({
          message:
            "This account is not verified. A new verification email has been sent.",
          type: "warning",
          showResend: true,
        });
      } else {
        setNotification({
          message: errorMessage,
          type: "error",
          showResend: false,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      badge="Operator portal"
      title="Log in to manage pickup and delivery operations"
      description="Operators get a modern, touch-friendly login that keeps routing, tracking, and account recovery easy to reach."
      supportLine="Use the operator credentials issued by your company."
      highlights={["Operations", "Route updates", "Fast access"]}
      artwork={loginVector}
      artworkAlt="Operator login background artwork"
    >
      <div className="space-y-5 sm:space-y-6">
        <NotificationBox
          message={notification.message}
          type={notification.type}
          showResend={notification.showResend}
          onResend={handleResend}
        />

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
                Operator access
              </p>
              <p className="text-[2.1rem] font-black leading-[0.92] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
                Operator Login
              </p>
              <p className="max-w-xl text-sm leading-6 text-white/62 sm:text-[1.05rem] sm:leading-7">
                Enter your company email and password to continue.
              </p>
            </div>
            <div className="rounded-full border border-[#D5E400]/18 bg-[#D5E400]/10 px-4 py-3 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F6FF6A]/75">
                Operator
              </p>
              <p className="text-sm font-semibold text-[#F6FF6A]">Login</p>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label
              htmlFor="operator-login-email"
              className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45"
            >
              Email
            </label>
            <div
              className={`flex items-center gap-3 rounded-[1rem] border border-white/10 bg-black/70 px-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.14)] transition ${
                errors.email
                  ? "border-red-500/60 bg-red-500/10"
                  : "focus-within:border-[#D5E400]/40"
              }`}
            >
              <Icon icon="solar:letter-bold-duotone" className="text-lg text-white/38" />
              <input
                id="operator-login-email"
                type="email"
                placeholder="name@company.com"
                value={email}
                autoComplete="email"
                inputMode="email"
                aria-invalid={Boolean(errors.email)}
                aria-describedby="operator-login-email-error"
                onBlur={() =>
                  setTouched((currentValue) => ({ ...currentValue, email: true }))
                }
                onChange={(e) => {
                  setEmail(e.target.value);
                  setNotification({ message: "", type: "", showResend: false });
                }}
                className="w-full bg-transparent py-4 text-base text-white placeholder:text-white/40 focus:outline-none"
              />
            </div>
            <span
              id="operator-login-email-error"
              className={`block text-sm text-red-400 transition-all duration-300 ${
                errors.email ? "opacity-100" : "opacity-0"
              }`}
            >
              {errors.email || " "}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="operator-login-password"
                className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F6FF6A] transition hover:text-[#fff37a]"
              >
                Forgot Password?
              </Link>
            </div>
            <div
              className={`relative rounded-[1rem] border border-white/10 bg-black/70 px-4 pr-14 shadow-[inset_0_-1px_0_rgba(255,255,255,0.14)] transition ${
                errors.password
                  ? "border-red-500/60 bg-red-500/10"
                  : "focus-within:border-[#D5E400]/40"
              }`}
            >
              <Icon icon="solar:lock-password-bold-duotone" className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-white/38" />
              <input
                id="operator-login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby="operator-login-password-error"
                onBlur={() =>
                  setTouched((currentValue) => ({ ...currentValue, password: true }))
                }
                onChange={(e) => {
                  setPassword(e.target.value);
                  setNotification({ message: "", type: "", showResend: false });
                }}
                className="w-full bg-transparent py-4 pl-8 text-base text-white placeholder:text-white/40 focus:outline-none"
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/55 transition hover:text-white"
                onClick={() => setShowPassword((currentValue) => !currentValue)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <Icon
                  icon={showPassword ? "ri:eye-close-fill" : "streamline:eye-optic-remix"}
                  width={18}
                />
              </button>
            </div>
            <span
              id="operator-login-password-error"
              className={`block text-sm text-red-400 transition-all duration-300 ${
                errors.password ? "opacity-100" : "opacity-0"
              }`}
            >
              {errors.password || " "}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-white/75">
            <span>
              Don&apos;t have an account?{" "}
              <Link
                href="/operator/register"
                className="font-semibold text-[#F6FF6A] underline underline-offset-4 transition hover:text-[#fff37a]"
              >
                Sign Up
              </Link>
            </span>
          </div>

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#D5E400] bg-transparent px-6 py-3.5 text-base font-semibold text-[#D5E400] transition-all duration-300 hover:bg-[#D5E400] hover:text-black hover:shadow-[0_18px_40px_-24px_rgba(213,228,0,0.75)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Icon icon="line-md:loading-loop" className="text-lg" />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>

        <div className="flex items-center gap-4 py-1 text-white/65">
          <div className="h-px w-full bg-white/15" />
          <span className="text-xs uppercase tracking-[0.22em]">or</span>
          <div className="h-px w-full bg-white/15" />
        </div>

        <Link
          href="/api/auth/google/login?role=operator&intent=login"
          className="relative flex items-center justify-center gap-3 rounded-full border border-[#6e7400]/40 bg-[#5b5f09] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#70750a] hover:shadow-[0_20px_40px_-24px_rgba(156,184,0,0.55)]"
        >
          <Image
            src={googleVector}
            width={24}
            alt="Google logo"
            className="absolute left-4 top-0 bottom-0 my-auto rounded-full bg-black/15 p-1"
          />
          <span className="ml-6">Sign in with Google</span>
        </Link>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<section className="min-h-screen bg-[#0A0D09]" />}>
      <LoginPageContent />
    </Suspense>
  );
}
