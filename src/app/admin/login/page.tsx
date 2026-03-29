"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { useRouter, useSearchParams } from "next/navigation";
import loginVector from "@/assets/images/loginvector.png";
import googleVector from "@/assets/images/googleVector.png";
import {
  loginUser,
  resendAdminOtp,
  resendVerificationEmail,
  verifyAdminOtp,
} from "@/services/auth";
import { useToast } from "@/context/ToastContext";
import NotificationBox from "@/components/NotificationBox";
import { getErrorMessage, normalizeAuthQueryError } from "@/lib/authError";
import AuthShell from "@/components/AuthShell";
import {
  GENERIC_AUTH_ERROR_MESSAGE,
  getEmailValidationMessage,
  getOtpValidationMessage,
  getPasswordValidationMessage,
  normalizeEmail,
} from "@/lib/authFlow";

type AuthStep = "credentials" | "otp";

function AdminLoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<AuthStep>("credentials");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<{
    email?: boolean;
    password?: boolean;
    otp?: boolean;
  }>({});
  const [notification, setNotification] = useState({
    message: "",
    type: "" as "success" | "warning" | "error" | "",
    showResend: false,
  });

  const errors = useMemo(() => {
    const nextErrors: {
      email?: string;
      password?: string;
      otp?: string;
    } = {};

    if (step === "credentials") {
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
    }

    if (step === "otp" && (submitAttempted || touched.otp)) {
      const otpMessage = getOtpValidationMessage(otpCode, 6);
      if (otpMessage) {
        nextErrors.otp = otpMessage;
      }
    }

    return nextErrors;
  }, [
    email,
    otpCode,
    password,
    step,
    submitAttempted,
    touched.email,
    touched.otp,
    touched.password,
  ]);

  const isSubmitDisabled =
    loading ||
    (step === "credentials"
      ? !email.trim() || !password.trim() || Boolean(errors.email || errors.password)
      : !otpCode.trim() || Boolean(errors.otp));

  useEffect(() => {
    const registered = searchParams.get("registered");
    const error = searchParams.get("error");
    const otpRequired = searchParams.get("otpRequired");
    const deletionScheduled = searchParams.get("deletionScheduled");

    if (registered === "true") {
      addToast(
        "Registration successful! Please check your email to verify your account.",
        "success",
      );
    }

    if (otpRequired === "true") {
      setStep("otp");
      setNotification({
        message:
          "Admin one-time access code has been sent to your email. Enter it below to continue.",
        type: "success",
        showResend: false,
      });
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
    }
  }, [searchParams, addToast]);

  const handleResendVerification = async () => {
    const normalizedEmail = normalizeEmail(email);
    const emailError = getEmailValidationMessage(normalizedEmail);

    if (emailError) {
      setTouched((currentValue) => ({ ...currentValue, email: true }));
      setSubmitAttempted(true);
      return;
    }

    try {
      const response = await resendVerificationEmail(normalizedEmail);
      addToast(response.message || "Verification email sent successfully.", "success");
    } catch (error: unknown) {
      addToast(getErrorMessage(error, "Failed to resend verification email."), "error");
    }
  };

  const handleResendAdminOtp = async () => {
    setLoading(true);
    try {
      const response = await resendAdminOtp();
      setNotification({
        message: response.message || "A fresh access code has been sent.",
        type: "success",
        showResend: false,
      });
    } catch (error: unknown) {
      setNotification({
        message: getErrorMessage(error, "Failed to resend access code."),
        type: "error",
        showResend: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const submitCredentials = async () => {
    setSubmitAttempted(true);
    setTouched((currentValue) => ({
      ...currentValue,
      email: true,
      password: true,
    }));

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
        adminLogin: true,
      })) as {
        requiresOtp?: boolean;
        message?: string;
      };

      if (response.requiresOtp) {
        setStep("otp");
        setPassword("");
        setOtpCode("");
        setSubmitAttempted(false);
        setTouched({});
        setNotification({
          message:
            response.message ||
            "One-time admin access code has been sent to your email.",
          type: "success",
          showResend: false,
        });
        return;
      }

      router.push("/dashboard");
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, GENERIC_AUTH_ERROR_MESSAGE);

      if (errorMessage.includes("Account not verified")) {
        setNotification({
          message: "This account is not verified. A new verification email has been sent.",
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

  const submitOtp = async () => {
    setSubmitAttempted(true);
    setTouched((currentValue) => ({ ...currentValue, otp: true }));

    const otpError = getOtpValidationMessage(otpCode, 6);
    if (otpError) return;

    setLoading(true);
    setNotification({ message: "", type: "", showResend: false });

    try {
      await verifyAdminOtp(otpCode);
      router.push("/dashboard");
    } catch (error: unknown) {
      setNotification({
        message: getErrorMessage(error, GENERIC_AUTH_ERROR_MESSAGE),
        type: "error",
        showResend: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step === "otp") {
      await submitOtp();
      return;
    }

    await submitCredentials();
  };

  const shellTitle =
    step === "otp" ? "Verify admin access with your code" : "Secure admin login";
  const shellDescription =
    step === "otp"
      ? "The code flow is optimized for quick verification on smaller screens and still keeps the full login context on desktop."
      : "Admins get a balanced login workspace with clearer prompts, safer error handling, and a quick path to one-time access.";

  return (
    <AuthShell
      badge="Admin portal"
      title={shellTitle}
      description={shellDescription}
      supportLine="Use your admin email and password, or switch to the one-time access code when prompted."
      highlights={
        step === "otp"
          ? ["One-time code", "Resend access", "Protected route"]
          : ["Credentials", "Google sign-in", "Protected route"]
      }
      artwork={loginVector}
      artworkAlt="Admin login background artwork"
    >
      <div className="space-y-5 sm:space-y-6">
        <NotificationBox
          message={notification.message}
          type={notification.type}
          showResend={notification.showResend}
          onResend={handleResendVerification}
        />

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
                Admin access
              </p>
              <p className="text-[2.1rem] font-black leading-[0.92] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
                {step === "otp" ? "Verify access code" : "Admin login"}
              </p>
              <p className="max-w-xl text-sm leading-6 text-white/62 sm:text-[1.05rem] sm:leading-7">
                {step === "otp"
                  ? "Enter the 6-digit code sent to your email to complete the secure sign-in."
                  : "Enter your admin email and password to continue to the dashboard."}
              </p>
            </div>
            <div className="rounded-full border border-[#D5E400]/18 bg-[#D5E400]/10 px-4 py-3 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F6FF6A]/75">
                Admin
              </p>
              <p className="text-sm font-semibold text-[#F6FF6A]">
                {step === "otp" ? "OTP" : "Login"}
              </p>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/70">
            {step === "otp"
              ? "The code flow is optimized for quick verification on smaller screens and still keeps the full login context on desktop."
              : "Admins get a balanced login workspace with clearer prompts, safer error handling, and a quick path to one-time access."}
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {step === "credentials" ? (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  Email address
                </label>
                <div
                  className={`flex items-center rounded-[1rem] border px-4 transition-all ${
                    errors.email
                      ? "border-red-500/70 bg-red-500/10"
                      : "border-white/10 bg-black/35 focus-within:border-[#D5E400]/35 focus-within:bg-black/50 focus-within:shadow-[0_0_0_4px_rgba(213,228,0,0.08)]"
                  }`}
                >
                  <Icon icon="solar:letter-bold-duotone" className="text-lg text-white/38" />
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    autoComplete="email"
                    inputMode="email"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby="admin-login-email-error"
                    onBlur={() =>
                      setTouched((currentValue) => ({ ...currentValue, email: true }))
                    }
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setNotification({ message: "", type: "", showResend: false });
                    }}
                    className="w-full bg-transparent py-4 text-base text-white placeholder:text-white/35 focus:outline-none"
                  />
                </div>
                <span
                  id="admin-login-email-error"
                  className={`block text-sm text-red-400 transition-all duration-300 ${
                    errors.email ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {errors.email || " "}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F6FF6A] transition hover:text-[#fff37a]"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div
                  className={`flex items-center rounded-[1rem] border px-4 transition-all ${
                    errors.password
                      ? "border-red-500/70 bg-red-500/10"
                      : "border-white/10 bg-black/35 focus-within:border-[#D5E400]/35 focus-within:bg-black/50 focus-within:shadow-[0_0_0_4px_rgba(213,228,0,0.08)]"
                  }`}
                >
                  <Icon icon="solar:lock-password-bold-duotone" className="text-lg text-white/38" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby="admin-login-password-error"
                    onBlur={() =>
                      setTouched((currentValue) => ({ ...currentValue, password: true }))
                    }
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setNotification({ message: "", type: "", showResend: false });
                    }}
                    className="w-full bg-transparent py-4 text-base text-white placeholder:text-white/35 focus:outline-none"
                  />
                  <button
                    type="button"
                    className="text-white/50 transition hover:text-white"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <Icon
                      icon={showPassword ? "ri:eye-close-fill" : "streamline:eye-optic-remix"}
                      width={18}
                    />
                  </button>
                </div>
                <span
                  id="admin-login-password-error"
                  className={`block text-sm text-red-400 transition-all duration-300 ${
                    errors.password ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {errors.password || " "}
                </span>
              </div>
            </>
          ) : (
            <>
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
                    aria-describedby="admin-login-otp-error"
                    onBlur={() =>
                      setTouched((currentValue) => ({ ...currentValue, otp: true }))
                    }
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setOtpCode(value);
                      setNotification({ message: "", type: "", showResend: false });
                    }}
                    className="w-full bg-transparent py-4 text-base tracking-[0.32em] text-white placeholder:text-white/35 focus:outline-none"
                  />
                </div>
                <span
                  id="admin-login-otp-error"
                  className={`block text-sm text-red-400 transition-all duration-300 ${
                    errors.otp ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {errors.otp || " "}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/75 md:text-sm">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 font-semibold text-[#F6FF6A] transition hover:text-[#fff37a]"
                  onClick={() => {
                    setStep("credentials");
                    setSubmitAttempted(false);
                    setNotification({ message: "", type: "", showResend: false });
                    setTouched({});
                  }}
                >
                  <Icon icon="solar:arrow-left-broken" className="text-sm" />
                  Back to password login
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 font-semibold text-[#F6FF6A] transition hover:text-[#fff37a] disabled:opacity-50"
                  onClick={handleResendAdminOtp}
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
            </>
          )}

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#D5E400] bg-transparent px-6 py-3.5 font-semibold text-[#D5E400] transition-all duration-300 hover:bg-[#D5E400] hover:text-black hover:shadow-[0_18px_40px_-24px_rgba(213,228,0,0.75)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Icon icon="line-md:loading-loop" className="text-lg" />
                {step === "otp" ? "Verifying..." : "Logging in..."}
              </>
            ) : step === "otp" ? (
              "Verify Access"
            ) : (
              "Login"
            )}
          </button>
        </form>

        {step === "credentials" ? (
          <>
            <div className="flex items-center gap-3 text-white/65">
              <div className="h-px w-full bg-white/12" />
              <span className="text-xs font-semibold uppercase tracking-[0.22em]">or</span>
              <div className="h-px w-full bg-white/12" />
            </div>

            <Link
              href="/api/auth/google/login?portal=admin&intent=login"
              className="relative flex items-center justify-center gap-3 rounded-full border border-[#9CB800]/20 bg-[#5b5f09] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#70750a] hover:shadow-[0_20px_40px_-24px_rgba(156,184,0,0.55)]"
            >
              <Image
                src={googleVector}
                width={24}
                alt="Google logo"
                className="absolute bottom-0 left-4 top-0 my-auto rounded-full bg-black/15 p-1"
              />
              <span className="ml-6">Continue with Google</span>
            </Link>
          </>
        ) : null}
      </div>
    </AuthShell>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<section className="min-h-screen bg-[#0A0D09]" />}>
      <AdminLoginPageContent />
    </Suspense>
  );
}
