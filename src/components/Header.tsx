"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { ThemeContext } from "./ThemeProvider";
import applogo from "@/assets/images/applogo.png";
import { HEADER_NAV_LINKS, HEADER_ACTIONS } from "@/data/nav";
import { STRINGS } from "@/lib/strings";

type AuthAction = "Login" | "Register";

const AUTH_OPTIONS: Record<AuthAction, Array<{ label: string; route: string; hint: string }>> = {
  Login: [
    { label: "Public User", route: "/login", hint: "Track, book, and manage deliveries" },
    { label: "Operator", route: "/operator/login", hint: "Pickup, drop, and route operations" },
    { label: "Admin", route: "/admin/login", hint: "Business and service control panel" },
  ],
  Register: [
    { label: "Public User", route: "/register", hint: "Create a customer account" },
    { label: "Operator", route: "/operator/register", hint: "Join the operations team" },
  ],
};

const isAuthAction = (label: string): label is AuthAction => label === "Login" || label === "Register";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { toggle } = useContext(ThemeContext);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authMenuOpen, setAuthMenuOpen] = useState<AuthAction | null>(null);
  const [mobileAuthMenuOpen, setMobileAuthMenuOpen] = useState<AuthAction | null>(null);
  const authActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 18);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!authMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!authActionsRef.current) return;
      if (!authActionsRef.current.contains(event.target as Node)) {
        setAuthMenuOpen(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAuthMenuOpen(null);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [authMenuOpen]);

  const closeMenus = () => {
    setMobileOpen(false);
    setAuthMenuOpen(null);
    setMobileAuthMenuOpen(null);
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
        <div
          className={`mx-auto flex max-w-7xl items-center justify-between rounded-full border px-4 py-2 sm:px-5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            scrolled
              ? "border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(0,0,0,0.1))] shadow-[0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl"
              : "border-white/5 bg-black/10 backdrop-blur-md"
          }`}
        >
          <Link href="/" onClick={closeMenus} className="flex items-center gap-3 active:scale-95 transition-transform">
            <Image src={applogo} alt={STRINGS.brand.logoAlt} width={112} height={52} className="h-10 w-auto object-contain" priority />
            <div className="hidden sm:block">
              <p className="text-sm font-semibold tracking-[0.22em] text-[#F6FF6A]">{STRINGS.brand.shortName}</p>
              <p className="text-xs text-white/55">{STRINGS.brand.appName}</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-2 py-2 lg:flex">
            {HEADER_NAV_LINKS.map(({ label, href, icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={label}
                  href={href}
                  onClick={closeMenus}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-95 ${
                    isActive
                      ? "bg-[#D5E400]/20 text-[#F6FF6A] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                      : "text-white/70 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <Icon icon={icon} className="text-base" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div ref={authActionsRef} className="hidden items-center gap-2 lg:flex">
            {HEADER_ACTIONS.map(({ label, route }) => {
              const authAction = isAuthAction(label) ? label : null;
              const isOpen = authAction ? authMenuOpen === authAction : false;

              return (
                <div key={label} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (authAction) {
                        setAuthMenuOpen((current) => (current === authAction ? null : authAction));
                        return;
                      }
                      setAuthMenuOpen(null);
                      router.push(route);
                    }}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-95 ${
                      label === "Register"
                        ? "border-[#D5E400]/30 bg-[linear-gradient(135deg,rgba(213,228,0,0.2),rgba(150,180,50,0.1))] text-[#F6FF6A] hover:bg-[#D5E400]/25 shadow-[0_0_15px_rgba(213,228,0,0.15)]"
                        : "border-white/10 bg-white/[0.04] text-white/90 hover:bg-white/[0.1] shadow-sm"
                    }`}
                  >
                    <span>{label}</span>
                    {authAction ? (
                      <Icon
                        icon={isOpen ? "solar:alt-arrow-up-line-duotone" : "solar:alt-arrow-down-line-duotone"}
                        className="text-sm"
                      />
                    ) : null}
                  </button>

                  {authAction && isOpen ? (
                    <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#10150f]/94 shadow-2xl backdrop-blur-xl">
                      {AUTH_OPTIONS[authAction].map(({ label: optionLabel, route: optionRoute, hint }) => (
                        <button
                          key={optionRoute}
                          type="button"
                          onClick={() => {
                            setAuthMenuOpen(null);
                            router.push(optionRoute);
                          }}
                          className="w-full border-b border-white/8 px-4 py-4 text-left transition last:border-b-0 hover:bg-white/[0.05]"
                        >
                          <p className="text-sm font-medium text-white">{optionLabel}</p>
                          <p className="mt-1 text-xs text-white/52">{hint}</p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => {
              setMobileOpen((current) => !current);
              setAuthMenuOpen(null);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white lg:hidden active:scale-90 transition-transform shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
          >
            <Icon icon={mobileOpen ? "mdi:close" : "mdi:menu"} className="text-xl" />
          </button>
        </div>
      </header>

      <div className={`fixed inset-0 z-40 transition ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
        <div
          className={`absolute inset-0 bg-black/50 transition ${mobileOpen ? "opacity-100" : "opacity-0"}`}
          onClick={closeMenus}
        />
        <div
          className={`absolute inset-x-0 top-0 mx-3 mt-[4.5rem] rounded-[2rem] border border-white/15 bg-[linear-gradient(180deg,rgba(30,35,30,0.85),rgba(20,25,20,0.95))] p-4 shadow-[0_40px_100px_rgba(0,0,0,0.5)] backdrop-blur-3xl transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] sm:mx-6 sm:mt-[5rem] ${
            mobileOpen ? "translate-y-0 opacity-100 scale-100" : "-translate-y-8 opacity-0 scale-95"
          }`}
        >
          <div className="rounded-[1.6rem] border border-[#D5E400]/15 bg-[linear-gradient(180deg,rgba(205,214,69,0.08),rgba(255,255,255,0.02))] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#F6FF6A]">Navigate</p>
            <div className="mt-4 grid gap-2">
              {HEADER_NAV_LINKS.map(({ label, href, icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={label}
                    href={href}
                    onClick={closeMenus}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                      isActive
                        ? "border-[#D5E400]/20 bg-[#D5E400]/10 text-[#F6FF6A]"
                        : "border-white/8 bg-white/[0.03] text-white/78"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20">
                        <Icon icon={icon} className="text-lg" />
                      </span>
                      {label}
                    </span>
                    <Icon icon="solar:arrow-right-up-linear" className="text-base text-white/35" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            {HEADER_ACTIONS.map(({ label, route }) => {
              const authAction = isAuthAction(label) ? label : null;
              const isOpen = authAction ? mobileAuthMenuOpen === authAction : false;

              if (!authAction) {
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      closeMenus();
                      router.push(route);
                    }}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm font-medium text-white"
                  >
                    {label}
                  </button>
                );
              }

              return (
                <div key={label} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                  <button
                    type="button"
                    onClick={() => setMobileAuthMenuOpen((current) => (current === authAction ? null : authAction))}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-white"
                  >
                    <span>{label}</span>
                    <Icon
                      icon={isOpen ? "solar:alt-arrow-up-line-duotone" : "solar:alt-arrow-down-line-duotone"}
                      className="text-base"
                    />
                  </button>

                  {isOpen ? (
                    <div className="border-t border-white/8 bg-black/20 px-3 py-2">
                      {AUTH_OPTIONS[authAction].map(({ label: optionLabel, route: optionRoute, hint }) => (
                        <button
                          key={optionRoute}
                          type="button"
                          onClick={() => {
                            closeMenus();
                            router.push(optionRoute);
                          }}
                          className="mb-2 w-full rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3 text-left last:mb-0"
                        >
                          <p className="text-sm text-white">{optionLabel}</p>
                          <p className="mt-1 text-xs text-white/52">{hint}</p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">Theme</p>
              <p className="text-xs text-white/52">Switch the visual mode for the public site.</p>
            </div>
            <button
              type="button"
              onClick={toggle}
              className="rounded-full border border-[#D5E400]/25 bg-[#D5E400]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#F6FF6A]"
            >
              Toggle
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
