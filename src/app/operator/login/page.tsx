"use client";

import React, { Suspense, useState, useEffect } from "react";
import Loginvector from "@/assets/images/loginvector.png";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import googleVector from "@/assets/images/googleVector.png";
import { loginUser, resendVerificationEmail } from "@/services/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/context/ToastContext";
import NotificationBox from "@/components/NotificationBox";
import { getErrorMessage, normalizeAuthQueryError } from "@/lib/authError";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({
    message: "",
    type: "" as "success" | "warning" | "error" | "",
    showResend: false,
  });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const role = "operator" as const;

  useEffect(() => {
    const registered = searchParams.get("registered");
    const error = searchParams.get("error");

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
    }
  }, [searchParams, addToast]);

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email))
      newErrors.email = "Enter a valid email address";
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleResend = async () => {
    if (!email) {
      addToast(
        "Please enter the email address of the unverified account.",
        "error",
      );
      return;
    }
    try {
      const response = await resendVerificationEmail(email);
      addToast(response.message || "Verification email sent successfully.", "success");
    } catch (error: unknown) {
      addToast(
        getErrorMessage(error, "Failed to resend verification email."),
        "error",
      );
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setNotification({ message: "", type: "", showResend: false });

    try {
      await loginUser({ email, password, role });
      router.push("/dashboard");
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, "Login failed. Please try again.");

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
    <section>
      <div className="relative h-[120vh] md:h-screen flex flex-col  md:justify-end py-12 px-6 md:py-20 md:px-20 text-white">
        <Link
          href="/"
          className="
  absolute 
  top-2 right-2
  sm:top-3 sm:right-3
  md:top-4 md:right-4
  z-50
"
        >
          <div
            className="
    flex gap-2 items-center
    bg-gray-600/60 hover:bg-gray-700
    cursor-pointer
    px-2 py-1 text-sm
    sm:px-3 sm:py-1.5 sm:text-sm
    md:px-4 md:py-2 md:text-base
    rounded-lg text-white
  "
          >
            <Icon icon="solar:home-2-broken" className="text-sm md:text-base" />
            <span className="">Return to Home</span>
          </div>
        </Link>

        <div className="absolute bg-[#25421E] top-0 left-0 w-[95%] md:w-[75%] h-[50%] rounded-br-[60%] md:h-full lg:h-full"></div>
        <div className="absolute inset-0 h-full w-full md:w-[70%] lg:w-[70%] flex flex-col">
          <Image
            src={Loginvector}
            alt="vector image"
            className="object-cover"
          ></Image>
        </div>
        <div
          className=" top-[55%] w-[90%] translate-y-46 md:relative left-auto md:top-auto md:translate-y-0 md:ml-6 md:w-auto"
        >
          <div className="flex   items-center gap-4 md:gap-8">
            <p className="z-50 relative text-6xl md:text-9xl font-bold">
              Hapus
            </p>
            <p className="z-50 mt-4 text text-center relative text-lg md:text-2xl font-medium line-clamp-2">
              Travels & <br /> Logistics
            </p>
          </div>
          <div>
            <p className="z-50 text-sm md:text-base relative mt-3 md:mt-12 text-white/80">
              Log in with confidence — your luggage is in safe hands with Hapus
              Logistics.
            </p>
          </div>
        </div>

        <div
          className="
    absolute
    left-1/2 top-[65%] -translate-x-1/2 -translate-y-1/2
    px-7 py-6
    bg-black/40
    rounded-[10%]
    md:rounded-[8%]
    flex flex-col
    max-w-md w-[90%]

    md:left-auto md:top-auto md:translate-x-0 md:translate-y-0
    md:right-20 md:bottom-20
    md:px-10 md:py-8
  "
        >
          <div className="pb-3 md:pb-4">
            <NotificationBox
              message={notification.message}
              type={notification.type}
              showResend={notification.showResend}
              onResend={handleResend}
            />
          </div>

          <p className="text-white font-bold text-2xl md:text-3xl mb-6">Operator Login</p>

          <form onSubmit={submit} className="flex flex-col gap-4">

            {/* Email */}
            <div className="flex flex-col">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                className={`bg-black px-4 pt-4 pb-2 rounded-lg text-base md:text-lg border-b-2 transition-all duration-300
      ${errors.email ? "border-red-500" : "border-white/60 focus:border-white"}
      focus:outline-none`}
              />
              <span className={`text-sm text-red-400 mt-1 transition-all duration-300 ${errors.email ? "opacity-100" : "opacity-0"}`}>
                {errors.email || " "}
              </span>
            </div>

            {/* Password */}
            <div className="flex flex-col relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                className={`bg-black px-4 pt-4 pb-2 rounded-lg text-base md:text-lg border-b-2 transition-all duration-300
      ${errors.password ? "border-red-500" : "border-white/60 focus:border-white"}
      focus:outline-none`}
              />

              <div
                className="absolute right-8 md:right-6 top-[40%] md:top-1/2 -translate-y-1/2 cursor-pointer"
                onClick={() => {
                  setShowPassword((v) => !v);
                  setTimeout(() => setShowPassword((v) => !v), 1000);
                }}
              >
                <Icon
                  icon="streamline:eye-optic-remix"
                  width={18}
                  className={`absolute text-white/60 transition-all duration-300 ${showPassword ? "opacity-100" : "opacity-0"}`}
                />
                <Icon
                  icon="ri:eye-close-fill"
                  width={18}
                  className={`absolute text-white/60 transition-all duration-300 ${showPassword ? "opacity-0" : "opacity-100"}`}
                />
              </div>

              <span className={`text-sm text-red-400 mt-1 transition-all duration-300 ${errors.password ? "opacity-100" : "opacity-0"}`}>
                {errors.password || " "}
              </span>
            </div>

            {/* Links */}
            <div className="flex  justify-between items-center gap-2   text-xs md:text-sm text-white/80 mt-2">
              <span className="w-1/2 md:w-full">
                Don&apos;t have an account?{" "}
                <Link href="/operator/register" className="text-[#D5E400] underline cursor-pointer">
                  Sign Up
                </Link>
              </span>
              <Link href="/forgot-password" className="text-[#D5E400] underline cursor-pointer">
                Forgot Password?
              </Link>
            </div>

            {/* Button */}
            <button
              type="submit"
              disabled={loading}
              className="
      self-end mt-4 md:mt-6
      px-6 md:px-8 py-2
      rounded-full border border-[#D5E400]
      text-[#D5E400] font-semibold
      transition-all duration-300
      hover:shadow-2xl hover:shadow-[#D5E400]/60
      hover:bg-[#D5E400] hover:text-black
      disabled:opacity-50
    "
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Icon icon="line-md:loading-loop" className="text-lg" />
                  Logging in...
                </span>
              ) : "Login"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 mt-4 text-white/80">
            <div className="w-full h-0.5 bg-white/40"></div>
            <span>or</span>
            <div className="w-full h-0.5 bg-white/40"></div>
          </div>

          {/* Google Button */}
          <Link
            href="/api/auth/google/login?role=operator&intent=login"
            className="
    relative flex mt-4 mx-auto
    bg-[#404811]/60
    px-10 md:px-24 py-3
    rounded-full
    cursor-pointer justify-center
    group
    hover:bg-linear-120 from-[#637501] to-[#9cb800]
    hover:shadow-2xl hover:shadow-[#9cb800]/60
  "
          >
            <Image
              src={googleVector}
              width={32}
              alt="Google logo"
              className="absolute left-2 top-0 bottom-0 my-auto group-hover:bg-green-950/40 p-2 rounded-full"
            />
            <span className="text-sm ml-4 md:ml-0 md:text-base">Sign in with Google</span>
          </Link>

        </div>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<section className="min-h-screen bg-[#25421E]" />}>
      <LoginPageContent />
    </Suspense>
  );
}
