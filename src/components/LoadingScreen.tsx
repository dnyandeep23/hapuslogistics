"use client";
import React from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

type LoadingScreenProps = {
  title?: string;
  message?: string;
  showLoginLink?: boolean;
};

const LoadingScreen = ({
  title = "Loading your workspace",
  message = "Please wait while we prepare your dashboard.",
  showLoginLink = false,
}: LoadingScreenProps) => {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#0c1209] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(165,196,62,0.22),transparent_38%),radial-gradient(circle_at_80%_18%,rgba(88,124,35,0.2),transparent_35%),radial-gradient(circle_at_50%_86%,rgba(232,235,120,0.1),transparent_42%)]" />
      <div className="absolute -left-14 top-28 h-44 w-44 rounded-full border border-[#b8d464]/20 blur-sm" />
      <div className="absolute bottom-10 right-8 h-56 w-56 rounded-full border border-[#dfe47c]/15 blur-sm" />

      <div className="relative flex h-full w-full items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-[#88955f]/35 bg-[#1f2a1a]/70 p-8 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#cfde6f]/50 bg-[#cddf6f]/10">
            <Icon icon="line-md:loading-twotone-loop" className="text-2xl text-[#e5ea8b]" />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-[#f2f6ca]">
            {title}
          </h2>
          <p className="mt-2 text-sm text-[#d4dfb4]">{message}</p>

          <div className="mt-6">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#a9bd63]/20">
              <div className="h-full w-1/3 animate-[loadingBar_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#cfe26d] via-[#e8ec95] to-[#8ca74a]" />
            </div>
          </div>

          {showLoginLink && (
            <div className="mt-5">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-[#d8e67f]/50 px-4 py-2 text-sm text-[#eaf1aa] transition-colors hover:bg-[#d8e67f]/15"
              >
                <Icon icon="solar:login-2-bold-duotone" className="text-lg" />
                Go to login
              </Link>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes loadingBar {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(340%);
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
