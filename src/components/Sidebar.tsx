"use client";
import React, { useState } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MenuItem } from "../data/roleMenus";
import { User } from "@/types";
import { useAppDispatch } from "@/lib/redux/hooks";
import { logoutUser } from "@/lib/redux/userSlice";

type Props = {
    user: User | null;
    role?: string;
    menus: Record<string, MenuItem[]>;
    isExpanded: boolean;
    setIsExpanded: (val: boolean) => void;
};


export default function Sidebar({ user, role = "user", menus, isExpanded, setIsExpanded }: Props) {
    const pathname = usePathname();
    const router = useRouter();
    const dispatch = useAppDispatch();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const items = menus[role] ?? menus["user"] ?? [];

    const getLogoutRedirectPath = () => {
        if (user?.isSuperAdmin || user?.role === "admin" || role === "admin" || role === "superadmin") {
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
    relative ml-3  min-h-[94vh] my-6
    bg-[#F5F6EE]/10 backdrop-blur-md
    text-white rounded-3xl shadow-xl
    transition-all duration-300 ease-in-out
    group
    ${isExpanded ? "w-64" : "w-22"}
  `}
        >
            {/* Arrow Button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="
      absolute -right-6 top-6
      bg-[#3F4539] text-[#B3D198]
      rounded-full p-2 
      opacity  opacity-100
      transition-opacity duration-300
      cursor-pointer
    "
            >
                <Icon
                    icon={isExpanded ? "hugeicons:sidebar-left-01" : "hugeicons:sidebar-right-01"}
                    className="text-2xl"
                />
            </button>

            {/* MAIN FLEX COLUMN */}
            <div className="flex flex-col py-4">

                {/* Top (Logo) */}
                <div className="flex justify-center mb-6 " onClick={() => router.push('/dashboard/profile')}>
                    <div className="border-4 border-[#436000] rounded-[30%] ">
                        <div className="w-12 h-12 bg-linear-to-br from-[#C1FF08] to-[#737373]
          flex items-center justify-center rounded-[30%]
          text-emerald-900 font-bold text-2xl">
                            {user?.name?.[0] ?? ""}
                        </div>
                    </div>
                </div>

                {/* User Info */}
                {user && isExpanded && (
                    <div className="text-center mb-6 px-2">
                        <div className="font-semibold">{user.name}</div>
                        <div className="text-xs text-emerald-300 truncate">
                            {user.email}
                        </div>
                    </div>
                )}

                {/* Menu (spaced nicely) */}
                <nav className="flex-1 w-full px-2 space-y-3">
                    {items.map((item) => {
                        const active = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
          flex items-center py-2 px-4 rounded-xl
          transition-all duration-1000 ease-in-out
          ${isExpanded ? "justify-start px-4 gap-3" : "justify-center w-18 flex-col text-xs gap-2 text-center"}
          ${active ? "bg-lime-500/10 text-[#E1FF00]" : "hover:bg-lime-800/50 text-[#B3D198]"}
        `}
                            >
                                <Icon icon={item.icon ?? "mdi:circle"} className="text-3xl transition-transform duration-1000" />

                                <span
                                    className={`transition-all duration-1000 ease-in-out `}
                                >
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>


                {/* Bottom (Logout always at bottom) */}
                <div className="mt-6 px-2 ">


                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className={`
              flex items-center py-2 w-full px-4 rounded-xl
              transition-colors text-[#B3D198] hover:text-red-300 cursor-pointer
              ${isExpanded ? "justify-start px-4 gap-3" : "justify-center flex-col  text-xs gap-2 text-center"}
             hover:bg-red-800/10 disabled:opacity-60 disabled:cursor-not-allowed
            `}
                    >
                        <Icon icon="solar:logout-3-bold-duotone" className="text-3xl" />
                        <span className="inline-flex items-center gap-2">
                            {isLoggingOut && <Icon icon="line-md:loading-loop" className="text-base" />}
                            {isLoggingOut ? "Logging out..." : "Logout"}
                        </span>
                    </button>
                </div>
            </div>
        </aside>

    );
}
