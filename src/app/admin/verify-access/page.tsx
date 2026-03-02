"use client";

import React, { Suspense, useEffect, useState } from "react";
import Loginvector from "@/assets/images/loginvector.png";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { resendAdminOtp, verifyAdminOtp } from "@/services/auth";
import { useRouter, useSearchParams } from "next/navigation";
import NotificationBox from "@/components/NotificationBox";
import { getErrorMessage } from "@/lib/authError";

function AdminVerifyAccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ otp?: string }>({});
  const [notification, setNotification] = useState({
    message: "",
    type: "" as "success" | "warning" | "error" | "",
  });

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
      message:
        "Enter the one-time admin access code sent to your registered email.",
      type: "success",
    });
  }, [searchParams]);

  const validateOtp = () => {
    const newErrors: typeof errors = {};
    if (!otpCode) {
      newErrors.otp = "Access code is required";
    } else if (!/^\d{6}$/.test(otpCode)) {
      newErrors.otp = "Access code must be 6 digits";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateOtp()) return;

    setLoading(true);
    setNotification({ message: "", type: "" });
    try {
      await verifyAdminOtp(otpCode);
      router.push("/dashboard");
    } catch (error: unknown) {
      setNotification({
        message: getErrorMessage(error, "Access code verification failed."),
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
        message: getErrorMessage(error, "Failed to resend access code."),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <div className="relative h-[120vh] md:h-screen flex flex-col md:justify-end py-12 px-6 md:py-20 md:px-20 text-white">
        <Link
          href="/"
          className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 z-50"
        >
          <div className="flex gap-2 items-center bg-gray-600/60 hover:bg-gray-700 cursor-pointer px-2 py-1 text-sm sm:px-3 sm:py-1.5 md:px-4 md:py-2 md:text-base rounded-lg text-white">
            <Icon icon="solar:home-2-broken" className="text-sm md:text-base" />
            <span>Return to Home</span>
          </div>
        </Link>

        <div className="absolute bg-[#25421E] top-0 left-0 w-[95%] md:w-[75%] h-[50%] rounded-br-[60%] md:h-full lg:h-full"></div>
        <div className="absolute inset-0 h-full w-full md:w-[70%] lg:w-[70%] flex flex-col">
          <Image src={Loginvector} alt="vector image" className="object-cover" />
        </div>

        <div className="top-[55%] w-[90%] translate-y-46 md:relative left-auto md:top-auto md:translate-y-0 md:ml-6 md:w-auto">
          <div className="flex items-center gap-4 md:gap-8">
            <p className="z-50 relative text-6xl md:text-9xl font-bold">Hapus</p>
            <p className="z-50 mt-4 text-center relative text-lg md:text-2xl font-medium line-clamp-2">
              Travels & <br /> Logistics
            </p>
          </div>
          <p className="z-50 text-sm md:text-base relative mt-3 md:mt-12 text-white/80">
            Verify admin access securely before continuing.
          </p>
        </div>

        <div className="absolute left-1/2 top-[65%] -translate-x-1/2 -translate-y-1/2 px-7 py-6 bg-black/40 rounded-[10%] md:rounded-[8%] flex flex-col max-w-md w-[90%] md:left-auto md:top-auto md:translate-x-0 md:translate-y-0 md:right-20 md:bottom-20 md:px-10 md:py-8">
          <div className="pb-3 md:pb-4">
            <NotificationBox message={notification.message} type={notification.type} />
          </div>

          <p className="text-white font-bold text-2xl md:text-3xl mb-6">Verify Admin Access</p>

          <form onSubmit={submitOtp} className="flex flex-col gap-4">
            <div className="flex flex-col">
              <input
                type="text"
                placeholder="6-digit access code"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtpCode(value);
                  setErrors((prev) => ({ ...prev, otp: undefined }));
                }}
                className={`bg-black px-4 pt-4 pb-2 rounded-lg text-base md:text-lg border-b-2 transition-all duration-300 tracking-[0.3em]
      ${errors.otp ? "border-red-500" : "border-white/60 focus:border-white"}
      focus:outline-none`}
              />
              <span
                className={`text-sm text-red-400 mt-1 transition-all duration-300 ${errors.otp ? "opacity-100" : "opacity-0"}`}
              >
                {errors.otp || " "}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs md:text-sm text-white/80">
              <Link href="/admin/login" className="text-[#D5E400] underline cursor-pointer">
                Back to Admin Login
              </Link>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[#D5E400] underline cursor-pointer disabled:opacity-50"
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
              disabled={loading}
              className="self-end mt-4 md:mt-6 px-6 md:px-8 py-2 rounded-full border border-[#D5E400] text-[#D5E400] font-semibold transition-all duration-300 hover:shadow-2xl hover:shadow-[#D5E400]/60 hover:bg-[#D5E400] hover:text-black disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Icon icon="line-md:loading-loop" className="text-lg" />
                  Verifying...
                </span>
              ) : "Verify Access"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

export default function AdminVerifyAccessPage() {
  return (
    <Suspense fallback={<section className="min-h-screen bg-[#25421E]" />}>
      <AdminVerifyAccessPageContent />
    </Suspense>
  );
}
