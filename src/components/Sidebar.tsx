"use client";
import React, { useState } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MenuItem } from "../data/roleMenus";
import { User } from "@/types";
import { useAppDispatch } from "@/lib/redux/hooks";
import { logoutUser } from "@/lib/redux/userSlice";
import { STRINGS } from "@/lib/strings";
import { resetPackageState } from "@/lib/redux/packageSlice";

type Props = {
    user: User | null;
    role?: string;
    menus: Record<string, MenuItem[]>;
    isExpanded: boolean;
    setIsExpanded: (val: boolean) => void;
};


export default function Sidebar({ user, role = "user", menus, isExpanded, setIsExpanded }: Props) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const dispatch = useAppDispatch();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const items = menus[role] ?? menus["user"] ?? [];
    const currentPathWithQuery = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;

    const isItemActive = (href: string) => {
        if (href.includes("?")) {
            return currentPathWithQuery === href;
        }
        const itemPath = href.split("?")[0];
        return pathname === itemPath;
    };

    const getLogoutRedirectPath = () => {
        if (user?.role === "admin" || role === "admin") {
            return "/admin/login";
        }
        if (user?.role === "operator" || role === "operator") {
            return "/operator/login";
        }
        return "/login";
    };

    const handleLogout = async () => {
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        const redirectPath = getLogoutRedirectPath();
        sessionStorage.setItem("logout_redirect", redirectPath);
        try {
            await dispatch(logoutUser()).unwrap();
        } catch {
            // Even if API logout fails, move user out of dashboard immediately.
        } finally {
            router.replace(redirectPath);
            setIsLoggingOut(false);
        }
    };


    return (
        <aside
            className={`
    relative ml-3 my-6 min-h-[94vh]
    rounded-[2rem] border border-white/10
    bg-[linear-gradient(180deg,rgba(245,246,238,0.14),rgba(14,19,11,0.18))]
    text-white shadow-[0_24px_60px_rgba(0,0,0,0.28)]
    backdrop-blur-xl transition-all duration-300 ease-in-out
    group 
    ${isExpanded ? "w-72" : "w-24"}
  `}
        >
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
                className={`absolute -right-6 top-7 z-50
flex h-8 w-6 items-center justify-center
rounded-r-xl border-t border-r-2 border-[#E4E67A]/70
${!isExpanded ? "bg-[#3a422e]" : "bg-[#2f342b]"}
text-[#E4E67A]
transition-all duration-300
hover:shadow-2xl hover:shadow-[#E4E67A]`}
            >
                <Icon
                    icon={isExpanded ? "mdi:chevron-left" : "mdi:chevron-right"}
                    className="text-2xl"
                />
            </button>

            <div className="flex h-full flex-col px-3 py-4">
                <div className={`mb-4 ${isExpanded ? "px-2" : "flex justify-center"}`}>
                    {isExpanded ? (
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d8e0b1]">
                                {STRINGS.brand.companyName}
                            </p>
                            <p className="mt-1 text-xs text-white/55">{STRINGS.brand.dashboardWorkspaceLabel}</p>
                        </div>
                    ) : (<></>
                        // <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E4E67A]">
                        //     HT
                        // </div>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => router.push("/dashboard/profile")}
                    className={`
          group/profile flex items-center rounded-[1.5rem] border border-white/10
          bg-white/5 text-left shadow-sm shadow-black/10 transition-all
          hover:-translate-y-0.5 hover:bg-white/10
          ${isExpanded ? "gap-3 px-3 py-3" : "flex-col gap-2 px-2 py-3"}
        `}
                >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#d5e400,#8fa82f)] text-lg font-bold text-[#14210d] shadow-md shadow-lime-950/20">
                        {user?.name?.[0] ?? ""}
                    </div>
                    {isExpanded ? (
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
                            <div className="mt-1 flex items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-[#d5e400]/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E4E67A]">
                                    {role}
                                </span>
                                <span className="truncate text-xs text-white/60">{user?.email}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E4E67A]">
                                {role}
                            </span>
                            <span className="sr-only">{user?.name ?? "Profile"}</span>
                        </div>
                    )}
                </button>

                <nav className="mt-6 flex-1 space-y-2" aria-label="Dashboard navigation">
                    {items.map((item) => {
                        const active = isItemActive(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={(e) => {
                                    if (item.href === "/package") {
                                        dispatch(resetPackageState());
                                    }
                                }}
                                className={`
          group/item relative flex items-center overflow-hidden rounded-[1.25rem] border transition-all duration-300
          ${isExpanded ? "justify-start gap-3 px-3 py-3 pr-4" : "flex-col gap-1 px-2 py-3 text-center"}
          ${active
                                        ? "border-[#d5e400]/25 bg-[linear-gradient(135deg,rgba(213,228,0,0.16),rgba(255,255,255,0.04))] text-[#F2FF8F] shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
                                        : "border-transparent bg-white/0 text-[#C5D2AC] hover:border-white/10 hover:bg-white/5 hover:text-[#F2FF8F]"
                                    }
        `}
                            >
                                <span
                                    className={`
              absolute inset-y-2 left-0 w-1 rounded-r-full transition-opacity
              ${active ? "bg-[#d5e400] opacity-100" : "bg-transparent opacity-0"}
            `}
                                />
                                <span
                                    className={`
              relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all duration-300
              ${active ? "bg-[#d5e400]/18 text-[#F2FF8F] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]" : "bg-white/5 text-[#C5D2AC] group-hover/item:bg-white/10 group-hover/item:text-[#F2FF8F]"}
            `}
                                >
                                    <Icon icon={item.icon ?? "mdi:circle"} className="text-2xl" />
                                </span>
                                {isExpanded ? (
                                    <>
                                        <span className="text-sm font-medium tracking-tight">{item.label}</span>
                                        {active ? <Icon icon="mdi:chevron-right" className="ml-auto text-base text-[#F2FF8F]/80" /> : null}
                                    </>
                                ) : (
                                    <span className="max-w-full text-[10px] font-semibold uppercase tracking-[0.14em]">
                                        {item.label}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-4 border-t border-white/10 pt-4">
                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className={`
              flex w-full items-center rounded-[1.25rem] border border-white/10
              bg-white/5 px-3 py-3 text-[#C5D2AC]
              transition-all hover:border-[#f3b6b6]/30 hover:bg-[#f3b6b6]/10 hover:text-[#f3d0d0]
              disabled:cursor-not-allowed disabled:opacity-60
              ${isExpanded ? "justify-start gap-3" : "flex-col gap-2 text-center"}
            `}
                    >
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5">
                            <Icon icon="solar:logout-3-bold-duotone" className="text-2xl" />
                        </span>
                        <span className="inline-flex items-center gap-2 text-sm font-medium">
                            {isLoggingOut && <Icon icon="line-md:loading-loop" className="text-base" />}
                            {isLoggingOut ? "Logging out..." : "Logout"}
                        </span>
                    </button>
                </div>
            </div>
        </aside>

    );
}
