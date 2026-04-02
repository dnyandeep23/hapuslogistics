"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { useRouter, useSearchParams } from "next/navigation";
import googleVector from "@/assets/images/googleVector.png";
import loginVector from "@/assets/images/loginvector.png";
import AuthShell from "@/components/AuthShell";
import AuthInput from "@/components/AuthInput";
import NotificationBox from "@/components/NotificationBox";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/authError";
import {
  appendRedirectParam,
  GENERIC_AUTH_ERROR_MESSAGE,
  getEmailValidationMessage,
  getPasswordValidationMessage,
  normalizeEmail,
  sanitizeRedirectPath,
} from "@/lib/authFlow";
import { loginUser, resendVerificationEmail } from "@/services/auth";

type LoginErrors = {
  email?: string;
  password?: string;
};

const getRedirectCopy = (redirectPath: string) => {
  if (redirectPath.startsWith("/package")) {
    return "Log in to continue your package booking.";
  }

  if (redirectPath.startsWith("/dashboard/orders")) {
    return "Log in to open your order details.";
  }

  if (redirectPath.startsWith("/dashboard")) {
    return "Log in to return to your dashboard.";
  }

  return "Log in to continue where you left off.";
};


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
  const role = "user" as const;

  const redirectTarget = useMemo(
    () => sanitizeRedirectPath(searchParams.get("redirect")),
    [searchParams],
  );
  const hasCustomRedirect = redirectTarget !== "/dashboard";
  const registerHref = useMemo(
    () => appendRedirectParam("/register", redirectTarget),
    [redirectTarget],
  );
  const forgotPasswordHref = useMemo(
    () => appendRedirectParam("/forgot-password", redirectTarget),
    [redirectTarget],
  );
  const googleLoginHref = useMemo(() => {
    const params = new URLSearchParams({
      role: "user",
      intent: "login",
      redirect: redirectTarget,
    });
    return `/api/auth/google/login?${params.toString()}`;
  }, [redirectTarget]);

  const errors = useMemo<LoginErrors>(() => {
    const nextErrors: LoginErrors = {};

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
    const incomingEmail = searchParams.get("email")?.trim();
    const registered = searchParams.get("registered");
    const error = searchParams.get("error");
    const deletionScheduled = searchParams.get("deletionScheduled");

    if (incomingEmail) {
      setEmail((currentValue) => currentValue || normalizeEmail(incomingEmail));
    }

    if (registered === "true") {
      addToast(
        "Registration successful. Please verify your email before logging in.",
        "success",
      );
    }

    if (error) {
      setNotification({
        message: getErrorMessage(error, GENERIC_AUTH_ERROR_MESSAGE),
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
  }, [addToast, searchParams]);

  const handleResend = async () => {
    const trimmedEmail = normalizeEmail(email);
    const emailError = getEmailValidationMessage(trimmedEmail);

    if (emailError) {
      setTouched((currentValue) => ({ ...currentValue, email: true }));
      setSubmitAttempted(true);
      return;
    }

    try {
      const response = await resendVerificationEmail(trimmedEmail);
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    setSubmitAttempted(true);
    setTouched({ email: true, password: true });

    const trimmedEmail = normalizeEmail(email);
    const emailError = getEmailValidationMessage(trimmedEmail);
    const passwordError = getPasswordValidationMessage(password);

    if (emailError || passwordError) {
      return;
    }

    setLoading(true);
    setNotification({ message: "", type: "", showResend: false });

    try {
      const response = (await loginUser({
        email: trimmedEmail,
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
        router.replace("/dashboard/profile?forcePasswordChange=true");
        return;
      }

      addToast("Login successful. Redirecting you now.", "success");
      router.replace(redirectTarget);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, GENERIC_AUTH_ERROR_MESSAGE);

      if (errorMessage.toLowerCase().includes("not verified")) {
        setNotification({
          message:
            "Your account is not verified yet. Request a fresh verification email below.",
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
      badge="All users access"
      title="Log in to manage bookings and delivery"
      description="A cleaner all-user login that keeps tracking, bookings, and account recovery in one place."
      supportLine="Use your email and password to continue securely across mobile, tablet, and desktop."
      highlights={["Fast access", "Secure login", "Order tracking"]}
      artwork={loginVector}
      artworkAlt="Hapus login background vector"
    >
      <div className="space-y-4 sm:space-y-5">
        <NotificationBox
          message={notification.message}
          type={notification.type}
          showResend={notification.showResend}
          onResend={handleResend}
        />

        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
            All users access
          </p>
          <p className="text-[1.7rem] font-black leading-[0.96] tracking-tight text-white sm:text-[2.15rem]">
            Welcome back
          </p>
          <p className="max-w-lg text-sm leading-6 text-white/62 sm:text-[0.96rem] sm:leading-7">
            Sign in with your email and password to continue.
          </p>

          {hasCustomRedirect ? (
            <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 text-sm leading-6 text-white/70">
              {getRedirectCopy(redirectTarget)}
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <AuthInput
            id="login-email"
            label="Email Address"
            icon="solar:letter-bold-duotone"
            type="email"
            value={email}
            autoComplete="email"
            inputMode="email"
            error={errors.email}
            onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
            onChange={(event) => {
              setEmail(event.target.value);
              setNotification({ message: "", type: "", showResend: false });
            }}
          />

          <div className="space-y-1">
            <AuthInput
              id="login-password"
              label="Password"
              icon="solar:lock-password-bold-duotone"
              isPassword
              value={password}
              autoComplete="current-password"
              error={errors.password}
              onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
              onChange={(event) => {
                setPassword(event.target.value);
                setNotification({ message: "", type: "", showResend: false });
              }}
            />
            <div className="flex items-center justify-end pr-2 pt-1">
              <Link
                href={forgotPasswordHref}
                className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F6FF6A] transition hover:text-[#fff37a]"
              >
                Forgot Password?
              </Link>
            </div>
          </div>

          <div className="space-y-2 pt-1 text-sm text-white/70">
            <p>
              Don&apos;t have an account?{" "}
              <Link
                href={registerHref}
                className="font-semibold text-[#F6FF6A] underline underline-offset-4 transition hover:text-[#fff37a]"
              >
                Sign Up
              </Link>
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[linear-gradient(110deg,#D5E400_0%,#E9F628_50%,#D5E400_100%)] bg-size-[200%_auto] px-6 py-4 text-[1.05rem] font-bold text-black shadow-[0_0_20px_rgba(213,228,0,0.15)] transition-all duration-300 hover:bg-right hover:shadow-[0_0_30px_rgba(213,228,0,0.3)] disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Icon icon="line-md:loading-loop" className="text-xl" />
                Logging in...
              </>
            ) : (
              <>
                <Icon icon="solar:login-3-bold-duotone" width={22} className="transition-transform group-hover:translate-x-1" />
                Secure Login
              </>
            )}
          </button>
        </form>

        <div className="flex items-center gap-4 py-1 text-white/65">
          <div className="h-px w-full bg-white/15" />
          <span className="text-xs uppercase tracking-[0.22em]">or</span>
          <div className="h-px w-full bg-white/15" />
        </div>

        <Link
          href={googleLoginHref}
          className="relative flex items-center justify-center gap-3 rounded-full border border-[#6e7400]/40 bg-[#5b5f09] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#70750a] hover:shadow-[0_20px_40px_-24px_rgba(156,184,0,0.55)]"
        >
          <Image
            src={googleVector}
            width={24}
            alt="Google logo"
            className="absolute left-4 top-0 bottom-0 my-auto rounded-full bg-black/15 p-1"
          />
          <span className="ml-6 font-bold tracking-wide">Sign in with Google</span>
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
