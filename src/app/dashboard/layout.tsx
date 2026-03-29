"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/redux/hooks";
import LoadingScreen from "@/components/LoadingScreen";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import MobileHeader from "@/components/MobileHeader";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import { defaultRole, roleMenus } from "@/data/roleMenus";
import type { MenuItem } from "@/data/roleMenus";

type DashboardRoleKey = "user" | "operator" | "admin";

const getRoleKey = (user: { role?: string } | null): DashboardRoleKey => {
  if (!user) return defaultRole as DashboardRoleKey;
  if (user.role === "admin") return "admin";
  if (user.role === "operator") return "operator";
  return "user";
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isMobile, isTablet } = useResponsiveMode();
  const { user, loading, reason } = useAppSelector((state) => state.user);
  const router = useRouter();
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);

  const roleKey = useMemo(() => getRoleKey(user ?? null), [user]);
  const isAdminLocked = roleKey === "admin" && user?.hasRegisteredBus === false;
  const isAdminLockedAllowedPath =
    pathname === "/dashboard" ||
    pathname === "/dashboard/profile" ||
    pathname === "/dashboard/addbus";
  const shellBackgroundClass = useMemo(() => {
    if (roleKey === "admin") {
      return "bg-[linear-gradient(180deg,#111a1f,#1a2c33_50%,#0f171d)]";
    }
    return "bg-[linear-gradient(180deg,#10160f,#1a2416_50%,#10160f)]";
  }, [roleKey]);

  const effectiveMenus = useMemo<Record<string, MenuItem[]>>(() => {
    if (!isAdminLocked) return roleMenus;
    return {
      ...roleMenus,
      admin: [
        { href: "/dashboard", label: "Dashboard", icon: "mdi:view-dashboard" },
        { href: "/dashboard/addbus", label: "Add Bus", icon: "mdi:bus-plus" },
      ],
    };
  }, [isAdminLocked]);

  useEffect(() => {
    const logoutRedirect = sessionStorage.getItem("logout_redirect");
    const shouldRedirectByReason =
      reason === "NO_TOKEN" ||
      reason === "USER_NOT_FOUND" ||
      reason === "TOKEN_INVALID" ||
      reason === "LOGGED_OUT";

    if (shouldRedirectByReason || (!loading && !user)) {
      const target = reason === "LOGGED_OUT" && logoutRedirect ? logoutRedirect : "/login";
      if (reason === "LOGGED_OUT" && logoutRedirect) {
        sessionStorage.removeItem("logout_redirect");
      }
      router.replace(target);
    }
  }, [reason, loading, user, router]);

  useEffect(() => {
    if (user?.mustChangePassword && pathname !== "/dashboard/profile") {
      router.replace("/dashboard/profile?forcePasswordChange=true");
    }
  }, [pathname, router, user?.mustChangePassword]);

  useEffect(() => {
    if (isAdminLocked && !isAdminLockedAllowedPath) {
      router.replace("/dashboard");
    }
  }, [isAdminLocked, isAdminLockedAllowedPath, router]);

  if (loading) {
    return (
      <LoadingScreen
        title="Preparing dashboard"
        message="Loading your workspace modules."
      />
    );
  }

  if (!user) {
    return (
      <LoadingScreen
        title="Redirecting"
        message="Please log in to continue."
        showLoginLink
      />
    );
  }

  return (
    <div className={`relative text-white ${shellBackgroundClass} min-h-screen lg:min-h-[100vh] h-[100dvh] lg:h-auto flex flex-col lg:block overflow-hidden lg:overflow-visible`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-[-8rem] h-80 w-80 rounded-full bg-[#d5e400]/10 blur-3xl" />
        <div className="absolute right-[-8rem] top-28 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/3 h-80 w-80 rounded-full bg-[#667d3f]/10 blur-3xl" />
      </div>

      {/* Desktop Layout */}
      <div className="relative z-10 hidden min-w-0 lg:flex">
        <Sidebar
          user={user}
          role={roleKey}
          menus={effectiveMenus}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
        />

        <main className="min-w-0 flex-1 px-4 py-4 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1700px] rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-4 py-4 shadow-[0_30px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl sm:px-6 sm:py-6 lg:px-8 lg:py-8 transition-all">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile/Tablet App Layout */}
      <div className="relative z-10 flex h-dvh w-full flex-col lg:hidden no-scrollbar">
        <MobileHeader />

        {isTablet ? (
          <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(20,26,19,0.72),rgba(15,20,14,0.6))] px-4 py-3 backdrop-blur-xl">
            <div className="mx-auto flex max-w-[54rem] items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Tablet workspace</p>
                <p className="mt-1 text-sm font-semibold text-[#F6FF6A]">Balanced layout with wider cards and split content.</p>
              </div>
              <span className="rounded-full border border-[#d5e400]/25 bg-[#d5e400]/10 px-3 py-1 text-xs font-semibold text-[#F6FF6A]">
                {roleKey}
              </span>
            </div>
          </div>
        ) : null}

        <main className={`flex-1 overflow-y-auto no-scrollbar ${isMobile ? "px-3 py-4 pb-28" : "px-4 py-5 pb-30"}`}>
          <div className={`mx-auto w-full border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] shadow-[0_24px_60px_rgba(0,0,0,0.25)] backdrop-blur-2xl transition-all ${
            isMobile
              ? "max-w-[30rem] rounded-[1.75rem] p-3"
              : "max-w-[54rem] rounded-[2rem] p-5"
          }`}>
            {children}
          </div>
        </main>


        <BottomNav menus={effectiveMenus[roleKey] ?? effectiveMenus.user} />
      </div>
    </div>
  );
}
