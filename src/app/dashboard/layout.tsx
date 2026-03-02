"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/redux/hooks";
import LoadingScreen from "@/components/LoadingScreen";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import { defaultRole, roleMenus } from "@/data/roleMenus";
import type { MenuItem } from "@/data/roleMenus";

type DashboardRoleKey = "user" | "operator" | "admin" | "superadmin";

const getRoleKey = (user: { role?: string; isSuperAdmin?: boolean } | null): DashboardRoleKey => {
  if (!user) return defaultRole as DashboardRoleKey;
  if (user.isSuperAdmin) return "superadmin";
  if (user.role === "admin") return "admin";
  if (user.role === "operator") return "operator";
  return "user";
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
    if (roleKey === "superadmin") {
      return "bg-[linear-gradient(180deg,#11181f,#2a2233_50%,#161320)]";
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
    <div className={`min-h-screen overflow-x-hidden text-white ${shellBackgroundClass}`}>
      <div className="hidden min-w-0 lg:flex">
        <Sidebar
          user={user}
          role={roleKey}
          menus={effectiveMenus}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
        />

        <main className="min-w-0 flex-1 px-4 py-4 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      <div className="lg:hidden min-h-screen pb-24 px-4 py-4 sm:px-6 sm:py-6">
        <main>{children}</main>
      </div>

      <BottomNav menus={effectiveMenus[roleKey] ?? effectiveMenus.user} />
    </div>
  );
}
