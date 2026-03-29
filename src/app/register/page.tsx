"use client";

import React, {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { useRouter, useSearchParams } from "next/navigation";
import googleVector from "@/assets/images/googleVector.png";
import loginVector from "@/assets/images/loginvector.png";
import AuthShell from "@/components/AuthShell";
import NotificationBox from "@/components/NotificationBox";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/authError";
import {
  appendRedirectParam,
  GENERIC_AUTH_ERROR_MESSAGE,
  getConfirmPasswordValidationMessage,
  getEmailValidationMessage,
  getNameValidationMessage,
  getPasswordStrength,
  getPasswordValidationMessage,
  normalizeEmail,
  normalizeName,
  sanitizeRedirectPath,
} from "@/lib/authFlow";
import { registerUser } from "@/services/auth";

type RegisterErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};
const fieldShellClass =
  "rounded-[1rem] border border-white/10 bg-black/70 px-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.14)] transition focus-within:border-white/35";
const fieldRowClass = "flex items-center gap-3";

const getRedirectCopy = (redirectPath: string) => {
  if (redirectPath.startsWith("/package")) {
    return "Create an account once, then continue your booking flow.";
  }

  if (redirectPath.startsWith("/dashboard/orders")) {
    return "Create an account to view and manage your order details.";
  }

  return "Create your account and continue right where you left off.";
};

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const redirectTimerRef = useRef<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<{
    name?: boolean;
    email?: boolean;
    password?: boolean;
    confirmPassword?: boolean;
  }>({});
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
  const loginHref = useMemo(
    () => appendRedirectParam("/login", redirectTarget),
    [redirectTarget],
  );
  const googleRegisterHref = useMemo(() => {
    const params = new URLSearchParams({
      role: "user",
      intent: "register",
      redirect: redirectTarget,
    });
    return `/api/auth/google/login?${params.toString()}`;
  }, [redirectTarget]);
  const passwordStrength = useMemo(
    () => getPasswordStrength(password),
    [password],
  );

  const errors = useMemo<RegisterErrors>(() => {
    const nextErrors: RegisterErrors = {};

    if (submitAttempted || touched.name) {
      const nameMessage = getNameValidationMessage(name);
      if (nameMessage) {
        nextErrors.name = nameMessage;
      }
    }

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

    if (submitAttempted || touched.confirmPassword) {
      const confirmPasswordMessage = getConfirmPasswordValidationMessage(
        password,
        confirmPassword,
      );
      if (confirmPasswordMessage) {
        nextErrors.confirmPassword = confirmPasswordMessage;
      }
    }

    return nextErrors;
  }, [
    confirmPassword,
    email,
    name,
    password,
    submitAttempted,
    touched.confirmPassword,
    touched.email,
    touched.name,
    touched.password,
  ]);

  const isSubmitDisabled =
    loading ||
    !name.trim() ||
    !email.trim() ||
    !password.trim() ||
    !confirmPassword.trim() ||
    Boolean(errors.name || errors.email || errors.password || errors.confirmPassword);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const buildPostRegisterLoginHref = (nextEmail: string) => {
    const params = new URLSearchParams({
      registered: "true",
      email: nextEmail,
      redirect: redirectTarget,
    });
    return `/login?${params.toString()}`;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    setSubmitAttempted(true);
    setTouched({ name: true, email: true, password: true, confirmPassword: true });

    const trimmedName = normalizeName(name);
    const trimmedEmail = normalizeEmail(email);
    const nameError = getNameValidationMessage(trimmedName);
    const emailError = getEmailValidationMessage(trimmedEmail);
    const passwordError = getPasswordValidationMessage(password);
    const confirmPasswordError = getConfirmPasswordValidationMessage(
      password,
      confirmPassword,
    );

    if (nameError || emailError || passwordError || confirmPasswordError) {
      return;
    }

    setLoading(true);
    setNotification({ message: "", type: "", showResend: false });

    try {
      await registerUser({
        name: trimmedName,
        email: trimmedEmail,
        password,
        role,
      });

      setNotification({
        message:
          "Account created successfully. Check your inbox for the verification email. We’ll take you to login next.",
        type: "success",
        showResend: false,
      });
      addToast("Account created successfully.", "success");

      redirectTimerRef.current = window.setTimeout(() => {
        router.replace(buildPostRegisterLoginHref(trimmedEmail));
      }, 1200);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(
        error,
        GENERIC_AUTH_ERROR_MESSAGE,
      );

      if (errorMessage.toLowerCase().includes("already registered")) {
        setNotification({
          message: "This email is already registered. Log in to continue.",
          type: "warning",
          showResend: false,
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
      badge="All users registration"
      title="Create your account with a smoother start"
      description="A modern all-user registration flow for bookings, tracking, and faster return visits across every device."
      supportLine="Set up your account once with a secure password and a cleaner, icon-led form experience."
      highlights={["Fast setup", "Secure password", "Booking ready"]}
      artwork={loginVector}
      artworkAlt="Hapus registration background vector"
    >
      <div className="space-y-5 sm:space-y-6">
        <NotificationBox
          message={notification.message}
          type={notification.type}
          showResend={notification.showResend}
        />

        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
            All users registration
          </p>
          <p className="text-[1.7rem] font-black leading-[0.96] tracking-tight text-white sm:text-[2.15rem]">
            Create account
          </p>
          <p className="max-w-lg text-sm leading-6 text-white/62 sm:text-[0.96rem] sm:leading-7">
            Create your account with your name, email, and a strong password.
          </p>

          {hasCustomRedirect ? (
            <div className="rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white/70">
              {getRedirectCopy(redirectTarget)}
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label
              htmlFor="register-name"
              className="text-xs font-medium uppercase tracking-[0.18em] text-white/45"
            >
              Full name
            </label>
            <div
              className={`${fieldShellClass} ${
                errors.name
                  ? "border-red-500/70 bg-red-500/10"
                  : "focus-within:border-[#D5E400]/40"
              }`}
            >
              <div className={fieldRowClass}>
                <Icon icon="solar:user-bold-duotone" className="text-lg text-white/38" />
                <input
                  id="register-name"
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  autoComplete="name"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby="register-name-error"
                  onBlur={() =>
                    setTouched((currentValue) => ({ ...currentValue, name: true }))
                  }
                  onChange={(event) => {
                    setName(event.target.value);
                    setNotification({ message: "", type: "", showResend: false });
                  }}
                  className="w-full bg-transparent py-4 text-base text-white placeholder:text-white/35 focus:outline-none"
                />
              </div>
            </div>
            <span
              id="register-name-error"
              className={`block text-sm text-red-400 transition-all duration-300 ${
                errors.name ? "opacity-100" : "opacity-0"
              }`}
            >
              {errors.name || " "}
            </span>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="register-email"
              className="text-xs font-medium uppercase tracking-[0.18em] text-white/45"
            >
              Email address
            </label>
            <div
              className={`${fieldShellClass} ${
                errors.email
                  ? "border-red-500/70 bg-red-500/10"
                  : "focus-within:border-[#D5E400]/40"
              }`}
            >
              <div className={fieldRowClass}>
                <Icon
                  icon="solar:letter-bold-duotone"
                  className="text-lg text-white/38"
                />
                <input
                  id="register-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  autoComplete="email"
                  inputMode="email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby="register-email-error"
                  onBlur={() =>
                    setTouched((currentValue) => ({ ...currentValue, email: true }))
                  }
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setNotification({ message: "", type: "", showResend: false });
                  }}
                  className="w-full bg-transparent py-4 text-base text-white placeholder:text-white/35 focus:outline-none"
                />
              </div>
            </div>
            <span
              id="register-email-error"
              className={`block text-sm text-red-400 transition-all duration-300 ${
                errors.email ? "opacity-100" : "opacity-0"
              }`}
            >
              {errors.email || " "}
            </span>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="register-password"
              className="text-xs font-medium uppercase tracking-[0.18em] text-white/45"
            >
              Password
            </label>
            <div
              className={`relative ${fieldShellClass} ${
                errors.password
                  ? "border-red-500/70 bg-red-500/10"
                  : "focus-within:border-[#D5E400]/40"
              }`}
            >
              <div className={`${fieldRowClass} pr-10`}>
                <Icon
                  icon="solar:lock-password-bold-duotone"
                  className="text-lg text-white/38"
                />
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={password}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby="register-password-error register-password-help"
                  onBlur={() =>
                    setTouched((currentValue) => ({ ...currentValue, password: true }))
                  }
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setNotification({ message: "", type: "", showResend: false });
                  }}
                  className="w-full bg-transparent py-4 text-base text-white placeholder:text-white/35 focus:outline-none"
                />
              </div>
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 transition hover:text-white"
                onClick={() => setShowPassword((currentValue) => !currentValue)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <Icon
                  icon={showPassword ? "ri:eye-close-fill" : "streamline:eye-optic-remix"}
                  width={18}
                />
              </button>
            </div>
            <div
              id="register-password-help"
              className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3 text-xs text-white/55"
            >
              <div className="flex items-center justify-between gap-3">
                <span>Use at least 6 characters. 8+ with numbers or symbols is stronger.</span>
                {passwordStrength ? (
                  <span className={`font-semibold ${passwordStrength.tone}`}>
                    {passwordStrength.label}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${passwordStrength?.barClassName ?? "bg-white/15"}`}
                  style={{ width: `${passwordStrength?.value ?? 0}%` }}
                />
              </div>
              <p className="mt-2 leading-5 text-white/45">
                {passwordStrength?.helper ||
                  "A stronger password makes sign-in safer from the start."}
              </p>
            </div>
            <span
              id="register-password-error"
              className={`block text-sm text-red-400 transition-all duration-300 ${
                errors.password ? "opacity-100" : "opacity-0"
              }`}
            >
              {errors.password || " "}
            </span>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="register-confirm-password"
              className="text-xs font-medium uppercase tracking-[0.18em] text-white/45"
            >
              Confirm password
            </label>
            <div
              className={`relative ${fieldShellClass} ${
                errors.confirmPassword
                  ? "border-red-500/70 bg-red-500/10"
                  : "focus-within:border-[#D5E400]/40"
              }`}
            >
              <div className={`${fieldRowClass} pr-10`}>
                <Icon
                  icon="solar:shield-keyhole-bold-duotone"
                  className="text-lg text-white/38"
                />
                <input
                  id="register-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  aria-describedby="register-confirm-password-error"
                  onBlur={() =>
                    setTouched((currentValue) => ({
                      ...currentValue,
                      confirmPassword: true,
                    }))
                  }
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setNotification({ message: "", type: "", showResend: false });
                  }}
                  className="w-full bg-transparent py-4 text-base text-white placeholder:text-white/35 focus:outline-none"
                />
              </div>
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 transition hover:text-white"
                onClick={() => setShowConfirmPassword((currentValue) => !currentValue)}
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                <Icon
                  icon={showConfirmPassword ? "ri:eye-close-fill" : "streamline:eye-optic-remix"}
                  width={18}
                />
              </button>
            </div>
            <span
              id="register-confirm-password-error"
              className={`block text-sm text-red-400 transition-all duration-300 ${
                errors.confirmPassword ? "opacity-100" : "opacity-0"
              }`}
            >
              {errors.confirmPassword || " "}
            </span>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/72">
              Already have an account?{" "}
              <Link
                href={loginHref}
                className="font-semibold text-[#D5E400] transition hover:text-[#F6FF6A]"
              >
                Log in
              </Link>
            </p>

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="inline-flex min-w-36 items-center justify-center gap-2 rounded-full border border-[#9CB800] bg-[#D5E400]/6 px-8 py-3 text-base font-semibold text-[#F6FF6A] transition-all duration-300 hover:bg-[#D5E400] hover:text-[#17210F] hover:shadow-[0_18px_40px_-24px_rgba(213,228,0,0.8)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Icon icon="line-md:loading-loop" className="text-lg" />
                  Creating...
                </>
              ) : (
                <>
                  <Icon icon="solar:user-plus-bold-duotone" width={18} />
                  Create account
                </>
              )}
            </button>
          </div>
        </form>

        <div className="flex items-center gap-3 text-white/80">
          <div className="h-px w-full bg-white/12" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
            or
          </span>
          <div className="h-px w-full bg-white/12" />
        </div>

        <Link
          href={googleRegisterHref}
          className="relative flex items-center justify-center gap-3 rounded-full border border-[#9CB800]/20 bg-[#58670F]/70 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#72870E] hover:shadow-[0_20px_40px_-24px_rgba(156,184,0,0.7)]"
        >
          <Image
            src={googleVector}
            width={28}
            alt="Google logo"
            className="absolute bottom-0 left-3 top-0 my-auto rounded-full bg-black/15 p-1.5"
          />
          <span className="ml-6">Sign up with Google</span>
        </Link>
      </div>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<section className="min-h-screen bg-[#0A0D09]" />}>
      <RegisterPageContent />
    </Suspense>
  );
}
