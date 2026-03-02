"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { getRoleNavItems } from "@/services/dashboard/navigation";
import type { DashboardRole } from "@/types/dashboard";

type DashboardSidebarProps = {
  role: DashboardRole;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  adminLocked: boolean;
};

export default function DashboardSidebar({
  role,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  adminLocked,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const navItems = getRoleNavItems(role);

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#25421E]/95 backdrop-blur-xl border-r border-[#6f7d4f]/25 p-4 transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#d8e0b1]">Hapus Logistics</p>
            <h1 className="text-xl font-semibold text-[#E4E67A]">Control Hub</h1>
          </div>
          <button
            type="button"
            className="rounded-lg border border-white/20 p-2 text-white/80 lg:hidden"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            <Icon icon="mdi:close" className="text-lg" />
          </button>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const locked = adminLocked && item.lockForAdminWithoutBus;

            return (
              <Link
                key={item.href}
                href={locked ? "/dashboard/buses" : item.href}
                onClick={onCloseMobile}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-[#D5E400]/20 text-[#E4E67A]"
                    : "text-[#eef2d7] hover:bg-[#D5E400]/10"
                } ${locked ? "opacity-50" : "opacity-100"}`}
              >
                <Icon icon={item.icon} className="text-lg" />
                {!collapsed && (
                  <span className="flex items-center gap-2">
                    {item.label}
                    {locked && <span className="text-[10px] uppercase text-[#f4d07f]">Locked</span>}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      <aside className={`sticky top-0 hidden h-screen border-r border-[#6f7d4f]/25 bg-[#25421E]/95 p-3 backdrop-blur-xl lg:block ${collapsed ? "w-20" : "w-72"}`}>
        <div className="mb-6 flex items-center justify-between">
          {!collapsed && (
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#d8e0b1]">Hapus Logistics</p>
              <h1 className="text-xl font-semibold text-[#E4E67A]">Control Hub</h1>
            </div>
          )}
          <button
            type="button"
            className="rounded-lg border border-white/20 p-2 text-white/80"
            onClick={onToggleCollapse}
            aria-label="Toggle sidebar"
          >
            <Icon icon={collapsed ? "mdi:chevron-right" : "mdi:chevron-left"} className="text-lg" />
          </button>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const locked = adminLocked && item.lockForAdminWithoutBus;

            return (
              <Link
                key={item.href}
                href={locked ? "/dashboard/buses" : item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-[#D5E400]/20 text-[#E4E67A]"
                    : "text-[#eef2d7] hover:bg-[#D5E400]/10"
                } ${locked ? "opacity-50" : "opacity-100"}`}
              >
                <Icon icon={item.icon} className="text-lg" />
                {!collapsed && (
                  <span className="flex items-center gap-2">
                    {item.label}
                    {locked && <span className="text-[10px] uppercase text-[#f4d07f]">Locked</span>}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
