"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import type { MenuItem } from "../data/roleMenus";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { logoutUser } from "@/lib/redux/userSlice";

type Props = {
    menus: MenuItem[];
};

const PROFILE_ITEM: MenuItem = {
    href: "/dashboard/profile",
    label: "Profile",
    icon: "mdi:account-circle-outline",
};

export default function BottomNav({ menus }: Props) {
    const pathname = usePathname();
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.user);
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const getLogoutRedirectPath = () => {
        if (user?.isSuperAdmin || user?.role === "admin") {
            return "/admin/login";
        }
        if (user?.role === "operator") {
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
            // Even if API logout fails, move user out immediately.
        } finally {
            router.replace(redirectPath);
            setIsLoggingOut(false);
            setIsMoreOpen(false);
        }
    };

    const { bottomItems, remainingItems, hasMore, moreActive } = useMemo(() => {
        const sanitizedMenus = menus.filter((item) => item.href !== PROFILE_ITEM.href);
        const menuWithProfile = [...sanitizedMenus, PROFILE_ITEM];

        const uniqueOrdered: MenuItem[] = [];
        const seen = new Set<string>();
        for (const item of menuWithProfile) {
            if (!item.href || seen.has(item.href)) continue;
            seen.add(item.href);
            uniqueOrdered.push(item);
        }

        let primary = uniqueOrdered.slice(0, 3);
        const hasProfileInPrimary = primary.some((item) => item.href === PROFILE_ITEM.href);
        if (!hasProfileInPrimary) {
            if (primary.length < 3) {
                primary = [...primary, PROFILE_ITEM];
            } else {
                primary = [primary[0], primary[1], PROFILE_ITEM];
            }
        }

        const primaryHrefSet = new Set(primary.map((item) => item.href));
        const remaining = uniqueOrdered.filter((item) => !primaryHrefSet.has(item.href));
        const hasOverflow = remaining.length > 0;
        const isMoreActive = remaining.some(
            (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
        );

        return {
            bottomItems: primary,
            remainingItems: remaining,
            hasMore: hasOverflow,
            moreActive: isMoreActive,
        };
    }, [menus, pathname]);

    return (
        <>
            <div className="fixed bottom-4 left-0 right-0 lg:hidden z-50 pointer-events-auto">
                <aside
                    className="
          mx-3 h-20
          bg-[#F5F6EE]/10 backdrop-blur-md
          text-white rounded-3xl shadow-xl
          border border-emerald-900/40
        "
                >
                    <nav className="flex justify-around items-center h-full px-2 space-x-2">
                        {bottomItems.map((item) => {
                            const active =
                                pathname === item.href;

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`
                  flex flex-col items-center justify-center
                  flex-1 py-2 rounded-xl
                  transition-all duration-300
                  ${active
                                            ? "bg-lime-500/10 text-[#E1FF00]"
                                            : "hover:bg-lime-800/40 text-[#B3D198]"}
                `}
                                >
                                    <Icon icon={item.icon ?? "mdi:circle"} className="text-2xl" />
                                    <span className="text-xs mt-1">{item.label}</span>
                                </Link>
                            );
                        })}

                        {hasMore ? (
                            <button
                                type="button"
                                onClick={() => setIsMoreOpen(true)}
                                className={`flex flex-col items-center justify-center flex-1 py-2 rounded-xl transition-all duration-300 ${moreActive ? "bg-lime-500/10 text-[#E1FF00]" : "hover:bg-lime-800/40 text-[#B3D198]"}`}>
                                <Icon icon="mdi:dots-horizontal-circle-outline" className="text-2xl" />
                                <span className="text-xs mt-1">More</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                className="
                  flex flex-col items-center justify-center
                  flex-1 py-2 rounded-xl
                  transition-all duration-300
                  hover:bg-red-800/20 text-[#B3D198] disabled:opacity-60
                "
                            >
                                <Icon icon="solar:logout-3-bold-duotone" className="text-2xl" />
                                <span className="text-xs mt-1">{isLoggingOut ? "..." : "Logout"}</span>
                            </button>
                        )}
                    </nav>
                </aside>
            </div>

            {isMoreOpen && (
                <>
                    <button
                        type="button"
                        aria-label="Close more menu"
                        onClick={() => setIsMoreOpen(false)}
                        className="fixed inset-0 z-58 bg-black/45 lg:hidden"
                    />

                    <aside className="fixed inset-y-4 rounded-xl right-4 z-59 w-72 border-l border-emerald-900/40 bg-[#1c2b16]/55 p-4 backdrop-blur-md lg:hidden">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-base font-semibold text-[#E4E67A]">More Options</h2>
                            <button
                                type="button"
                                onClick={() => setIsMoreOpen(false)}
                                className="rounded-lg border border-white/20 p-2 text-white/80"
                                aria-label="Close"
                            >
                                <Icon icon="mdi:close" className="text-lg" />
                            </button>
                        </div>

                        <nav className="space-y-2">
                            {remainingItems.map((item) => {
                                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setIsMoreOpen(false)}
                                        className={`
                      flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all
                      ${active ? "bg-lime-500/10 text-[#E1FF00]" : "text-[#B3D198] hover:bg-lime-800/30"}
                    `}
                                    >
                                        <Icon icon={item.icon ?? "mdi:circle"} className="text-xl" />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="mt-6 border-t border-white/10 pt-4">
                            <button
                                type="button"
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#f0b2b2] transition-all hover:bg-red-800/20 disabled:opacity-60"
                            >
                                <Icon icon="solar:logout-3-bold-duotone" className="text-xl" />
                                <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
                            </button>
                        </div>
                    </aside>
                </>
            )}
        </>
    );
}
