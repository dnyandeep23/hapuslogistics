"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAppSelector } from "@/lib/redux/hooks";
import { isRouteAllowedForRole } from "@/services/dashboard/navigation";
import type { DashboardRole } from "@/types/dashboard";

export const useRoleAccess = () => {
  const pathname = usePathname();
  const { user } = useAppSelector((state) => state.user);

  const role = useMemo<DashboardRole | null>(() => {
    if (!user) return null;
    if (user.isSuperAdmin) return "superadmin";
    if (user.role === "admin") return "admin";
    if (user.role === "operator") return "operator";
    return null;
  }, [user]);

  const isAllowed = useMemo(() => {
    if (!role) return false;
    return isRouteAllowedForRole(pathname, role);
  }, [pathname, role]);

  return {
    role,
    isAllowed,
    pathname,
    user,
  };
};
