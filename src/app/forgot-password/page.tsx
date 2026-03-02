"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Loginvector from "@/assets/images/loginvector.png";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import NotificationBox from "@/components/NotificationBox";
import { useToast } from "@/context/ToastContext";
import { forgotPassword } from "@/services/auth";
import { getErrorMessage } from "@/lib/authError";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const router = useRouter();
  const [notification, setNotification] = useState({ message: '', type: '' as 'success' | 'warning' | 'error' | '' });
  const [errors, setErrors] = useState<{ email?: string; }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Enter a valid email address";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setNotification({ message: '', type: '' });

    try {
      const data = await forgotPassword(email);
      addToast(data.message || "Security code sent successfully!", "success");
      sessionStorage.setItem('reset-password-email', email);
      router.push("/reset-password");
    } catch (error: unknown) {
      setNotification({
        message: getErrorMessage(error, "Failed to send security code."),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

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
        <div className="absolute right-4 bottom-6 md:right-24 md:bottom-24 bg-black/40 px-6 md:px-12 py-8 rounded-[8%] flex flex-col w-full md:w-[480px]">
          <div className="pb-4">
            <NotificationBox message={notification.message} type={notification.type} />
          </div>
          <p className="text-white font-bold text-3xl mb-5">Forgot Password</p>

          <form onSubmit={handleSendCode} className="flex flex-col gap-4">
            <div className="flex flex-col">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors({});
                  setNotification({ message: '', type: '' });
                }}
                className={`bg-black px-4 pt-5 pb-2 rounded-lg text-lg border-b-2 transition-all duration-300 ${errors.email ? "border-red-500" : "border-white/60 focus:border-white"} focus:outline-none`}
              />
              <span className={`text-sm text-red-400 mt-1 transition-all duration-300 ${errors.email ? "opacity-100" : "opacity-0"}`}>{errors.email || " "}</span>
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
              {loading ? "Sending..." : "Send Security Code"}
            </button>
            <div className="flex justify-between items-center text-sm text-white/80 mt-2">
              <span>Remembered your password? <Link href="/login" className="text-[#D5E400] underline cursor-pointer">Log In</Link></span>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
