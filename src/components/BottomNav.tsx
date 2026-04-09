"use client";
import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import type { MenuItem } from "../data/roleMenus";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { logoutUser } from "@/lib/redux/userSlice";
import { resetPackageState } from "@/lib/redux/packageSlice";
import { useTranslation } from "@/lib/i18n/LanguageContext";

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
    const searchParams = useSearchParams();
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { t } = useTranslation();
    const { user } = useAppSelector((state) => state.user);
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const currentPathWithQuery = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;

    const isItemActive = useCallback((href: string) => {
        if (href.includes("?")) {
            return currentPathWithQuery === href;
        }
        const itemPath = href.split("?")[0];
        return pathname === itemPath;
    }, [currentPathWithQuery, pathname]);

    const getLogoutRedirectPath = () => {
        if (user?.role === "admin") {
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
        const isMoreActive = remaining.some((item) => isItemActive(item.href));

        return {
            bottomItems: primary,
            remainingItems: remaining,
            hasMore: hasOverflow,
            moreActive: isMoreActive,
        };
    }, [isItemActive, menus]);

    return (
        <>
            <div className="fixed bottom-4 left-0 right-0 lg:hidden z-50 pointer-events-auto">
                <aside
                    className="
          mx-3 h-20
          rounded-[1.75rem] border border-white/10
          bg-[linear-gradient(180deg,rgba(245,246,238,0.14),rgba(18,24,14,0.78))]
          text-white shadow-[0_20px_50px_rgba(0,0,0,0.28)]
          backdrop-blur-xl
        "
                >
                    <nav className="flex h-full items-center justify-around gap-2 px-2" aria-label="Mobile dashboard navigation">
                        {bottomItems.map((item) => {
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
                                    aria-current={active ? "page" : undefined}
                                    className={`
                  group/item relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl py-2
                  transition-all duration-300 transform active:scale-95
                  ${active ? "bg-[linear-gradient(135deg,rgba(213,228,0,0.2),rgba(255,255,255,0.05))] text-[#F6FF6A] shadow-[0_8px_22px_rgba(0,0,0,0.2)]" : "text-[#9AA685] hover:bg-white/5 hover:text-[#D5E400]"}
                `}
                                >
                                    <span className={`absolute inset-x-4 top-1 h-px rounded-full transition-opacity ${active ? "bg-[#d5e400]/70 opacity-100" : "bg-transparent opacity-0"}`} />
                                    <span className={`relative flex h-9 w-9 items-center justify-center rounded-2xl transition-all duration-300 ${active ? "bg-[#d5e400]/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]" : "bg-white/5 group-hover/item:bg-white/10"}`}>
                                        <Icon icon={item.icon ?? "mdi:circle"} className="text-xl" />
                                    </span>
                                    <span className="mt-1 text-[11px] font-medium tracking-tight">{(item.i18nKey ? t.nav[item.i18nKey as keyof typeof t.nav] : item.label) || item.label}</span>
                                </Link>
                            );
                        })}

                        {hasMore ? (
                            <button
                                type="button"
                                onClick={() => setIsMoreOpen(true)}
                                className={`group/item relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl py-2 transition-all duration-300 transform active:scale-95 ${moreActive ? "bg-[linear-gradient(135deg,rgba(213,228,0,0.2),rgba(255,255,255,0.08))] text-[#F6FF6A] shadow-[0_8px_22px_rgba(0,0,0,0.2)]" : "text-[#9AA685] hover:bg-white/5 hover:text-[#D5E400]"}`}>
                                <span className={`absolute inset-x-4 top-1 h-px rounded-full transition-opacity ${moreActive ? "bg-[#d5e400]/80 opacity-100 shadow-[0_0_10px_#d5e400]" : "bg-transparent opacity-0"}`} />
                                <span className={`relative flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-300 ${moreActive ? "bg-[#d5e400]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" : "bg-white/5 group-hover/item:bg-white/10"}`}>
                                    <Icon icon="mdi:dots-horizontal-circle-outline" className="text-xl" />
                                </span>
                                <span className="mt-1 text-[11px] font-semibold tracking-wide">{t.nav.more}</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                className="
                  group/item flex flex-1 flex-col items-center justify-center rounded-2xl py-2
                  text-[#C5D2AC] transition-all duration-300
                  hover:bg-[#f3b6b6]/10 hover:text-[#f3d0d0] disabled:opacity-60
                "
                            >
                                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5 transition-all duration-300 group-hover/item:bg-[#f3b6b6]/12">
                                    <Icon icon="solar:logout-3-bold-duotone" className="text-xl" />
                                </span>
                                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium tracking-tight">
                                    {isLoggingOut && <Icon icon="line-md:loading-loop" className="text-sm" />}
                                    {isLoggingOut ? t.nav.loggingOut : t.nav.logout}
                                </span>
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
                        className="fixed inset-0 z-58 bg-black/45 backdrop-blur-[1px] lg:hidden"
                    />

                    <aside
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="more-navigation-title"
                        className="fixed inset-y-3 right-3 z-59 flex w-[19rem] max-w-[calc(100vw-1.5rem)] flex-col rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(28,40,22,0.94),rgba(20,28,16,0.98))] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-xl lg:hidden"
                    >
                        <div className="mb-4 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#d5e400]/12 text-[#F2FF8F]">
                                    <Icon icon="mdi:menu-open" className="text-lg" />
                                </span>
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">{t.nav.navigation}</p>
                                    <h2 id="more-navigation-title" className="mt-1 text-lg font-semibold text-[#F2FF8F]">{t.nav.moreOptions}</h2>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsMoreOpen(false)}
                                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/85 transition-all hover:bg-white/10 hover:text-white"
                                aria-label="Close more menu"
                            >
                                <Icon icon="mdi:close" className="text-xl" />
                            </button>
                        </div>

                        <nav className="space-y-2 overflow-y-auto pr-1">
                            {remainingItems.map((item) => {
                                const active = isItemActive(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => {
                                            if (item.href === "/package") {
                                                dispatch(resetPackageState());
                                            }
                                            setIsMoreOpen(false);
                                        }}
                                        className={`
                      group/item flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition-all duration-300
                      ${active ? "border-[#d5e400]/20 bg-[linear-gradient(135deg,rgba(213,228,0,0.16),rgba(255,255,255,0.05))] text-[#F2FF8F]" : "border-white/5 text-[#C5D2AC] hover:border-white/10 hover:bg-white/5 hover:text-[#F2FF8F]"}
                    `}
                                    >
                                        <span className={`flex h-9 w-9 items-center justify-center rounded-2xl transition-all duration-300 ${active ? "bg-[#d5e400]/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]" : "bg-white/5 group-hover/item:bg-white/10"}`}>
                                            <Icon icon={item.icon ?? "mdi:circle"} className="text-xl" />
                                        </span>
                                        <span className="font-medium tracking-tight">{(item.i18nKey ? t.nav[item.i18nKey as keyof typeof t.nav] : item.label) || item.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="mt-6 border-t border-white/10 pt-4">
                            <button
                                type="button"
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                className="flex w-full items-center gap-3 rounded-2xl border border-[#f3b6b6]/15 bg-[#f3b6b6]/8 px-3 py-3 text-sm text-[#f0b2b2] transition-all hover:bg-[#f3b6b6]/14 disabled:opacity-60"
                            >
                                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5 transition-all duration-300">
                                    <Icon icon="solar:logout-3-bold-duotone" className="text-xl" />
                                </span>
                                <span className="inline-flex items-center gap-2 font-medium tracking-tight">
                                    {isLoggingOut && <Icon icon="line-md:loading-loop" className="text-base" />}
                                    {isLoggingOut ? t.nav.loggingOut : t.nav.logout}
                                </span>
                            </button>
                        </div>
                    </aside>
                </>
            )}
        </>
    );
}
