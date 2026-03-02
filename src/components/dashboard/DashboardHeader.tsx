"use client";

import React, { useMemo } from "react";
import { Icon } from "@iconify/react";
import type { DashboardRole } from "@/types/dashboard";

type DashboardHeaderProps = {
  role: DashboardRole;
  userName: string;
  onOpenMobileMenu: () => void;
  onLogout: () => void;
  unreadNotifications: number;
};

const roleLabel: Record<DashboardRole, string> = {
  operator: "Operator",
  admin: "Admin",
  superadmin: "SuperAdmin",
};

export default function DashboardHeader({
  role,
  userName,
  onOpenMobileMenu,
  onLogout,
  unreadNotifications,
}: DashboardHeaderProps) {
  const initials = useMemo(() => {
    const trimmed = userName.trim();
    if (!trimmed) return "HL";
    const parts = trimmed.split(" ");
    return `${parts[0]?.[0] ?? "H"}${parts[1]?.[0] ?? "L"}`.toUpperCase();
  }, [userName]);

  return (
    <header className="sticky top-0 z-30 border-b border-[#566044]/50 bg-[#2c3524]/95 px-4 py-3 backdrop-blur lg:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="rounded-lg border border-white/20 p-2 text-white/80 lg:hidden"
            aria-label="Open menu"
          >
            <Icon icon="mdi:menu" className="text-lg" />
          </button>

          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-white/75">{roleLabel[role]}</p>
            <h2 className="text-base font-semibold text-[#E4E67A]">Role Dashboard</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="relative rounded-lg border border-white/20 p-2 text-white/85 hover:bg-white/10"
            aria-label="Notifications"
          >
            <Icon icon="mdi:bell-outline" className="text-xl" />
            {unreadNotifications > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e6e97f] px-1 text-[10px] font-semibold text-[#25320f]">
                {unreadNotifications}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-[#1f251c]/85 px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D5E400]/20 text-xs font-semibold text-[#E4E67A]">
              {initials}
            </div>
            <span className="hidden text-sm text-white/85 sm:inline">{userName}</span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-[#cf7b7b]/40 px-3 py-2 text-sm text-[#f0b2b2] hover:bg-[#cf7b7b]/10"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
