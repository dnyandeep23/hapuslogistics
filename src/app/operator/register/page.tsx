"use client";

import React, { Suspense, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { useSearchParams } from "next/navigation";
import googleVector from "@/assets/images/googleVector.png";
import loginVector from "@/assets/images/loginvector.png";
import AuthShell from "@/components/AuthShell";
import NotificationBox from "@/components/NotificationBox";
import { registerUser } from "@/services/auth";
import { getErrorMessage } from "@/lib/authError";
import {
  GENERIC_AUTH_ERROR_MESSAGE,
  getConfirmPasswordValidationMessage,
  getEmailValidationMessage,
  getNameValidationMessage,
  getPasswordValidationMessage,
  normalizeEmail,
  normalizeName,
} from "@/lib/authFlow";

function RegisterPageContent() {
  const searchParams = useSearchParams();
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
  const role = "operator" as const;
  const initialError = searchParams.get("error");
  const errors = useMemo(() => {
    const nextErrors: {
      email?: string;
      password?: string;
      name?: string;
      confirmPassword?: string;
    } = {};

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setSubmitAttempted(true);
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    const normalizedName = normalizeName(name);
    const normalizedEmail = normalizeEmail(email);
    const nameError = getNameValidationMessage(normalizedName);
    const emailError = getEmailValidationMessage(normalizedEmail);
    const passwordError = getPasswordValidationMessage(password);
    const confirmPasswordError = getConfirmPasswordValidationMessage(
      password,
      confirmPassword,
    );

    if (nameError || emailError || passwordError || confirmPasswordError) return;

    setLoading(true);
    setNotification({ message: "", type: "", showResend: false });

    try {
      const response = await registerUser({
        name: normalizedName,
        email: normalizedEmail,
        password,
        role,
      });
      setNotification({
        message:
          response.message || "Registration successful! A verification email has been sent.",
        type: "success",
        showResend: true,
      });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(
        error,
        GENERIC_AUTH_ERROR_MESSAGE,
      );

      if (errorMessage.includes("User already exists")) {
        setNotification({
          message: "This email is already registered. Kindly log in to continue.",
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

  const handleGoogleRegister = () => {
    setSubmitAttempted(false);
    setTouched({});
    const params = new URLSearchParams({
      role: "operator",
      intent: "register",
    });
    window.location.href = `/api/auth/google/login?${params.toString()}`;
  };

  return (
    <AuthShell
      badge="Operator portal"
      title="Create an operator account"
      description="Operator sign-up stays streamlined, secure, and consistent with the modern auth family."
      supportLine="Use the email issued by your company and choose a strong password for first access."
      highlights={["Protected flow", "Secure setup", "Company access"]}
      artwork={loginVector}
      artworkAlt="Operator register background artwork"
    >
      <div className="space-y-5 sm:space-y-6">
        <NotificationBox
          message={notification.message || initialError || ""}
          type={notification.type || (initialError ? "warning" : "")}
          showResend={notification.showResend}
        />

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
                Operator registration
              </p>
              <p className="text-[2.1rem] font-black leading-[0.92] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
                Create account
              </p>
              <p className="max-w-xl text-sm leading-6 text-white/62 sm:text-[1.05rem] sm:leading-7">
                Add your name, company email, and password to get started.
              </p>
            </div>
            <div className="rounded-full border border-[#D5E400]/18 bg-[#D5E400]/10 px-4 py-3 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F6FF6A]/75">
                Operator
              </p>
              <p className="text-sm font-semibold text-[#F6FF6A]">Register</p>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label
              htmlFor="operator-register-name"
              className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45"
            >
              Full name
            </label>
            <div
              className={`flex items-center gap-3 rounded-[1rem] border border-white/10 bg-black/70 px-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.14)] transition ${
                errors.name
                  ? "border-red-500/60 bg-red-500/10"
                  : "focus-within:border-[#D5E400]/40"
              }`}
            >
              <Icon icon="solar:user-bold-duotone" className="text-lg text-white/38" />
              <input
                id="operator-register-name"
                type="text"
                placeholder="Your name"
                value={name}
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
                aria-describedby="operator-register-name-error"
                onBlur={() =>
                  setTouched((currentValue) => ({ ...currentValue, name: true }))
                }
                onChange={(e) => {
                  setName(e.target.value);
                  setNotification({ message: "", type: "", showResend: false });
                }}
                className="w-full bg-transparent py-4 text-base text-white placeholder:text-white/40 focus:outline-none"
              />
            </div>
            <span
              id="operator-register-name-error"
              className={`block text-sm text-red-400 transition-all duration-300 ${
                errors.name ? "opacity-100" : "opacity-0"
              }`}
            >
              {errors.name || " "}
            </span>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="operator-register-email"
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
                id="operator-register-email"
                type="email"
                placeholder="name@company.com"
                value={email}
                autoComplete="email"
                inputMode="email"
                aria-invalid={Boolean(errors.email)}
                aria-describedby="operator-register-email-error"
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
              id="operator-register-email-error"
              className={`block text-sm text-red-400 transition-all duration-300 ${
                errors.email ? "opacity-100" : "opacity-0"
              }`}
            >
              {errors.email || " "}
            </span>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="operator-register-password"
              className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45"
            >
              Password
            </label>
            <div
              className={`relative rounded-[1rem] border border-white/10 bg-black/70 px-4 pr-14 shadow-[inset_0_-1px_0_rgba(255,255,255,0.14)] transition ${
                errors.password
                  ? "border-red-500/60 bg-red-500/10"
                  : "focus-within:border-[#D5E400]/40"
              }`}
            >
              <Icon icon="solar:lock-password-bold-duotone" className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-white/38" />
              <input
                id="operator-register-password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                value={password}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby="operator-register-password-error"
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
            <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3 text-xs text-white/55">
              Use at least 6 characters. 8+ with numbers or symbols is stronger.
            </div>
            <span
              id="operator-register-password-error"
              className={`block text-sm text-red-400 transition-all duration-300 ${
                errors.password ? "opacity-100" : "opacity-0"
              }`}
            >
              {errors.password || " "}
            </span>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="operator-register-confirm-password"
              className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45"
            >
              Confirm password
            </label>
            <div
              className={`relative rounded-[1rem] border border-white/10 bg-black/70 px-4 pr-14 shadow-[inset_0_-1px_0_rgba(255,255,255,0.14)] transition ${
                errors.confirmPassword
                  ? "border-red-500/60 bg-red-500/10"
                  : "focus-within:border-[#D5E400]/40"
              }`}
            >
              <Icon icon="solar:shield-keyhole-bold-duotone" className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-white/38" />
              <input
                id="operator-register-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirmPassword}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmPassword)}
                aria-describedby="operator-register-confirm-password-error"
                onBlur={() =>
                  setTouched((currentValue) => ({
                    ...currentValue,
                    confirmPassword: true,
                  }))
                }
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setNotification({ message: "", type: "", showResend: false });
                }}
                className="w-full bg-transparent py-4 pl-8 text-base text-white placeholder:text-white/40 focus:outline-none"
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/55 transition hover:text-white"
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
              id="operator-register-confirm-password-error"
              className={`block text-sm text-red-400 transition-all duration-300 ${
                errors.confirmPassword ? "opacity-100" : "opacity-0"
              }`}
            >
              {errors.confirmPassword || " "}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-white/75">
            <span>
              Already have an account?{" "}
              <Link
                href="/operator/login"
                className="font-semibold text-[#F6FF6A] underline underline-offset-4 transition hover:text-[#fff37a]"
              >
                Log In
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
                Registering...
              </>
            ) : (
              "Register"
            )}
          </button>
        </form>

        <div className="flex items-center gap-4 py-1 text-white/65">
          <div className="h-px w-full bg-white/15" />
          <span className="text-xs uppercase tracking-[0.22em]">or</span>
          <div className="h-px w-full bg-white/15" />
        </div>

        <button
          type="button"
          onClick={handleGoogleRegister}
          className="relative flex items-center justify-center gap-3 rounded-full border border-[#6e7400]/40 bg-[#5b5f09] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#70750a] hover:shadow-[0_20px_40px_-24px_rgba(156,184,0,0.55)]"
        >
          <Image
            src={googleVector}
            width={24}
            alt="Google logo"
            className="absolute left-4 top-0 bottom-0 my-auto rounded-full bg-black/15 p-1"
          />
          <span className="ml-6">Sign up with Google</span>
        </button>
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
