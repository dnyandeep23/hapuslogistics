"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: string;
  error?: string;
  isPassword?: boolean;
}

export default function AuthInput({
  id,
  label,
  icon,
  error,
  isPassword = false,
  className,
  ...props
}: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full space-y-1.5">
      <div
        className={`relative flex items-center rounded-2xl border bg-white/3 px-4 backdrop-blur-xl transition-all duration-300 ${
          error
            ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
            : "border-white/10 hover:bg-white/4 focus-within:border-[#D5E400]/40 focus-within:bg-white/6 focus-within:shadow-[0_0_20px_rgba(213,228,0,0.1)]"
        } ${className || ""}`}
      >
        <span
          className={`shrink-0 transition-colors duration-300 ${
            error ? "text-red-400" : "text-white/40 focus-within:text-[#D5E400]"
          }`}
        >
          <Icon icon={icon} width={22} className="relative z-10" />
        </span>

        <div className="relative ml-4 flex h-14 w-full flex-col justify-center">
          <input
            id={id}
            type={isPassword && !showPassword ? "password" : "text"}
            placeholder=" "
            aria-invalid={Boolean(error)}
            className="peer w-full bg-transparent pt-3 text-[1.05rem] text-white/90 placeholder-transparent outline-none autofill:bg-transparent"
            {...props}
          />
          <label
            htmlFor={id}
            className={`pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-base transition-all duration-300 peer-focus:top-3 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:font-medium peer-focus:tracking-wide peer-focus:text-white/40 peer-focus:uppercase peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-medium peer-[:not(:placeholder-shown)]:tracking-wide peer-[:not(:placeholder-shown)]:text-white/40 peer-[:not(:placeholder-shown)]:uppercase ${
              error ? "text-red-400" : "text-white/50"
            }`}
          >
            {label}
          </label>
        </div>

        {isPassword && (
          <button
            type="button"
            className="shrink-0 p-2 text-white/40 transition-colors hover:text-white/80"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            <Icon
              icon={showPassword ? "ri:eye-close-fill" : "streamline:eye-optic-remix"}
              width={20}
            />
          </button>
        )}
      </div>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          error ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <span className="overflow-hidden text-[13px] text-red-400 px-2 font-medium">
          {error}
        </span>
      </div>
    </div>
  );
}
