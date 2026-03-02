"use client";

import React, { useState, useRef, ChangeEvent, KeyboardEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Loginvector from "@/assets/images/loginvector.png";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import NotificationBox from "@/components/NotificationBox";
import { useToast } from "@/context/ToastContext";
import { resetPassword, forgotPassword } from "@/services/auth";
import { getErrorMessage } from "@/lib/authError";

const RESEND_TIMEOUT = 60;

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [securityCode, setSecurityCode] = useState(new Array(8).fill(""));
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const router = useRouter();
  const [notification, setNotification] = useState({ message: '', type: '' as 'success' | 'warning' | 'error' | '' });
  const [errors, setErrors] = useState<{ securityCode?: string; password?: string, confirmPassword?: string }>({});
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendTimer, setResendTimer] = useState(RESEND_TIMEOUT);
  const [isResendDisabled, setIsResendDisabled] = useState(true);
  const [showCode, setShowCode] = useState(new Array(8).fill(false));
  const passwordTimer = useRef<NodeJS.Timeout | null>(null);
  const confirmPasswordTimer = useRef<NodeJS.Timeout | null>(null);
  const [realPassword, setRealPassword] = useState("");
  const [displayPassword, setDisplayPassword] = useState("");

  // Confirm password
  const [realConfirmPassword, setRealConfirmPassword] = useState("");
  const [displayConfirmPassword, setDisplayConfirmPassword] = useState("");

  useEffect(() => {
    const resetEmail = sessionStorage.getItem("reset-password-email");
    if (!resetEmail) {
      router.push("/forgot-password");
    } else {
      setEmail(resetEmail);
      setNotification({ message: `A code has been sent to ${resetEmail}.`, type: 'success' });
    }
  }, [router]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isResendDisabled) {
      timer = setInterval(() => {
        setResendTimer((prev) => {
          if (prev === 1) {
            clearInterval(timer);
            setIsResendDisabled(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isResendDisabled]);

  const handleResendCode = async () => {
    if (!email) return;
    setNotification({ message: "", type: "" });
    try {
      const data = await forgotPassword(email);
      setNotification({ message: `${data.message} \n Email Address : ${email}`, type: "success" });
      setResendTimer(RESEND_TIMEOUT);
      setIsResendDisabled(true);
    } catch (error: unknown) {
      setNotification({
        message: getErrorMessage(error, "Failed to resend security code."),
        type: "error",
      });
    }
  };


  const handlePasswordChange = (value: string) => {
    const lastChar = value.slice(-1);

    if (value.length < realPassword.length) {
      setRealPassword(realPassword.slice(0, -1));
      setDisplayPassword("•".repeat(Math.max(0, realPassword.length - 1)));
      return;
    }

    setRealPassword(prev => prev + lastChar);

    if (passwordTimer.current) clearTimeout(passwordTimer.current);

    setDisplayPassword("•".repeat(Math.max(0, realPassword.length)) + lastChar);

    passwordTimer.current = setTimeout(() => {
      setDisplayPassword("•".repeat(realPassword.length + 1));
    }, 1000);
  };


  const handleConfirmPasswordChange = (value: string) => {
    const lastChar = value.slice(-1);

    if (value.length < realConfirmPassword.length) {
      setRealConfirmPassword(realConfirmPassword.slice(0, -1));
      setDisplayConfirmPassword("•".repeat(Math.max(0, realConfirmPassword.length - 1)));
      return;
    }

    setRealConfirmPassword(prev => prev + lastChar);

    if (confirmPasswordTimer.current) clearTimeout(confirmPasswordTimer.current);

    setDisplayConfirmPassword(
      "•".repeat(Math.max(0, realConfirmPassword.length)) + lastChar
    );

    confirmPasswordTimer.current = setTimeout(() => {
      setDisplayConfirmPassword("•".repeat(realConfirmPassword.length + 1));
    }, 1000);
  };



  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const { value } = e.target;
    if (/[^0-9]/.test(value)) return;

    const newSecurityCode = [...securityCode];
    newSecurityCode[index] = value;
    setSecurityCode(newSecurityCode);

    setShowCode(prev => {
      const updated = [...prev];
      updated[index] = true;
      return updated;
    });

    setTimeout(() => {
      setShowCode(prev => {
        const updated = [...prev];
        updated[index] = false;
        return updated;
      });
    }, 1000);

    if (value && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  };


  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !securityCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 8).split('');
    if (pastedData.some(char => /[^0-9]/.test(char))) return;
    const newSecurityCode = [...securityCode];
    pastedData.forEach((char, index) => {
      newSecurityCode[index] = char;
    });
    setSecurityCode(newSecurityCode);
    inputRefs.current[pastedData.length - 1]?.focus();
  };

  const validate = () => {
    const newErrors: typeof errors = {};
    if (securityCode.join("").length !== 8) {
      newErrors.securityCode = "Security code must be 8 digits.";
    }
    if (!realPassword) {
      newErrors.password = "Password is required.";
    } else if (realPassword.length < 6) {
      newErrors.password = "Password must be at least 6 characters.";
    }
    if (realPassword !== realConfirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !email) return;

    setLoading(true);
    setNotification({ message: '', type: '' });

    try {

      const data = await resetPassword({
        email,
        securityCode: securityCode.join(""),
        password: realPassword,
      });
      addToast(data.message || "Password reset successful.", "success");
      sessionStorage.removeItem("reset-password-email");
      router.push("/login");
    } catch (error: unknown) {
      setNotification({
        message: getErrorMessage(error, "Password reset failed."),
        type: 'error',
      });
      setIsResendDisabled(false);
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return null; // or a loading spinner
  }

  return (
    <section className="text-white">
      <div className="relative h-screen flex flex-col justify-end py-12 px-6 md:py-20 md:px-20">
        <Link href={"/"} className="absolute top-4 right-4 z-50">
          <div className="flex gap-2 items-center bg-gray-600/60 hover:bg-gray-700 cursor-pointer px-4 py-2 rounded-lg text-white">
            <Icon icon="solar:home-2-broken" />
            <span>Return to Home</span>
          </div>
        </Link>
        <div className="absolute bg-[#25421E] top-0 left-0 w-[75%] rounded-br-[60%] h-full"></div>
        <div className="absolute inset-0 h-full w-[70%]  flex flex-col">
          <Image src={Loginvector} alt="vector image" className="object-cover"></Image>
        </div>
        <div className="flex ml-6  items-center  gap-8">
          <p className="z-50 relative text-9xl font-bold text-white">Hapus</p>
          <p className="z-50 mt-4 text text-center relative text-3xl font-medium text-white line-clamp-2">
            Travels & <br /> Logistics
          </p>
        </div>
        <div>
          <p className="z-50 ml-6 relative mt-12 text-white/80">
            Reset your password with confidence — your luggage is in safe hands
            with Hapus Logistics.
          </p>
        </div>
        <div className="absolute right-4 bottom-6 md:right-24 md:bottom-16 bg-black/40 px-6 md:px-12 py-8 rounded-[8%] flex flex-col w-full md:w-120">
          <div className="pb-4">
            <NotificationBox message={notification.message} type={notification.type} />
          </div>
          <p className="text-white font-bold text-3xl mb-5">Reset Password</p>

          <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
            <div>
              <label className="text-white/80 text-sm">Security Code</label>
              <div className="flex gap-2 mt-2" onPaste={handlePaste}>
                {securityCode.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type={showCode[index] ? "text" : "password"}
                    maxLength={1}
                    value={digit}
                    placeholder="0"
                    inputMode="numeric"
                    onChange={(e) => handleInputChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className={`w-10 h-12 text-center bg-black rounded-lg text-lg border-b-2 transition-all duration-300 ${errors.securityCode
                      ? "border-red-500"
                      : "border-white/60 focus:border-white"
                      } focus:outline-none`}
                  />

                ))}
              </div>
              <span className={`text-sm text-red-400 mt-1 transition-all duration-300 ${errors.securityCode ? "opacity-100" : "opacity-0"}`}>{errors.securityCode || " "}</span>
            </div>

            <div className="text-sm text-white/80 mt-1">
              {isResendDisabled ? (
                <span>Resend code in {resendTimer}s</span>
              ) : (
                <span onClick={handleResendCode} className="text-[#D5E400] underline cursor-pointer">
                  Resend Security Code
                </span>
              )}
            </div>

            <div className="flex flex-col">
              <input
                type="text"
                placeholder="New password"
                value={displayPassword}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className={`bg-black px-4 pt-5 pb-2 rounded-lg text-lg border-b-2 transition-all duration-300 ${errors.password ? "border-red-500" : "border-white/60 focus:border-white"
                  } focus:outline-none`}
              />
              <span className={`text-sm text-red-400 mt-1 transition-all duration-300 ${errors.password ? "opacity-100" : "opacity-0"}`}>{errors.password || " "}</span>
            </div>

            <div className="flex flex-col">

              <input
                type="text"
                placeholder="Confirm password"
                value={displayConfirmPassword}
                onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                className={`bg-black px-4 pt-5 pb-2 rounded-lg text-lg border-b-2 transition-all duration-300 ${errors.confirmPassword ? "border-red-500" : "border-white/60 focus:border-white"
                  } focus:outline-none`}
              />

              <span className={`text-sm text-red-400 mt-1 transition-all duration-300 ${errors.confirmPassword ? "opacity-100" : "opacity-0"}`}>{errors.confirmPassword || " "}</span>
            </div>

            <button
              type="submit"
              className="
                self-end mt-6 px-8 py-2 rounded-full
                border border-[#D5E400]
                text-[#D5E400] font-semibold
                transition-all duration-300
                cursor-pointer
                hover:shadow-2xl shadow-[#D5E400]/60
                hover:bg-[#D5E400] hover:text-black
              "
              disabled={loading}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Icon icon="line-md:loading-loop" className="text-lg" />
                  Resetting...
                </span>
              ) : "Reset Password"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
