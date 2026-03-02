"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";

import { ThemeContext } from "./ThemeProvider";
import applogo from "@/assets/images/applogo.png";
import { HEADER_NAV_LINKS, HEADER_ACTIONS } from "@/data/nav";

type AuthAction = "Login" | "Register";

const AUTH_OPTIONS: Record<AuthAction, Array<{ label: string; route: string; hint: string }>> = {
  Login: [
    {
      label: "Public User",
      route: "/login",
      hint: "Customer login",
    },
    {
      label: "Operator",
      route: "/operator/login",
      hint: "Operations dashboard login",
    },
    {
      label: "Admin",
      route: "/admin/login",
      hint: "Admin panel login",
    },
  ],
  Register: [
    {
      label: "Public User",
      route: "/register",
      hint: "Create customer account",
    },
    {
      label: "Operator",
      route: "/operator/register",
      hint: "Create operator account",
    },
    {
      label: "Admin",
      route: "/admin/register",
      hint: "Create admin account",
    },
  ],
};

const isAuthAction = (label: string): label is AuthAction =>
  label === "Login" || label === "Register";

export default function Header() {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);
  const router = useRouter();
  const { toggle } = useContext(ThemeContext);
  const [scrolled, setScrolled] = useState(false);

  const [active, setActive] = useState<string>("Register");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authMenuOpen, setAuthMenuOpen] = useState<AuthAction | null>(null);
  const [mobileAuthMenuOpen, setMobileAuthMenuOpen] = useState<AuthAction | null>(null);
  const authActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const threshold = 80;

    const handleScroll = () => {
      if (window.scrollY > threshold) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

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
      if (event.key === "Escape") {
        setAuthMenuOpen(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [authMenuOpen]);

  return (
    <header
      className={`
    fixed top-0 left-0 w-full z-50
    flex items-center justify-between px-8 py-6
    transition-all duration-300 ease-in-out
    ${scrolled ? "bg-black/5 backdrop-blur" : "bg-transparent"}
  `}
    >
      <Link
        href="/"
        onClick={() => {
          setAuthMenuOpen(null);
          setMobileAuthMenuOpen(null);
        }}
        className={`absolute left-8 top-5 z-50 ${scrolled ? "opacity-45" : "opacity-100"
          }`}
      >
        <Image
          src={applogo}
          alt="Hapus Logistics logo"
          width={120}
          height={56}
          className="object-contain"
          priority
        />
      </Link>

      <div className="w-35" />

      <nav id="navlinks" className="hidden md:flex gap-4">
        {HEADER_NAV_LINKS.map(({ label, href, icon }) => {
          const isActive = pathname === href;
          const showActiveBg = isActive && !hovered;

          return (
            <Link
              key={label}
              href={href}
              onClick={() => {
                setAuthMenuOpen(null);
                setMobileAuthMenuOpen(null);
              }}
            >
              <div
                onMouseEnter={() => setHovered(label)}
                onMouseLeave={() => setHovered(null)}
                className={`
            flex items-center gap-1.5 px-3 py-1 rounded-md text-[14px]
            cursor-pointer transition-all duration-700 ease-in-out
            ${showActiveBg
                    ? "bg-gray-600/60 text-white "
                    : "bg-transparent text-white/65"
                  }
            hover:bg-gray-600 hover:text-white
          `}
              >
                <Icon icon={icon} height={18} />
                {label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="md:hidden ml-auto">
        <button
          aria-label="Toggle menu"
          onClick={() => {
            setMobileOpen((current) => {
              const next = !current;
              if (!next) {
                setMobileAuthMenuOpen(null);
              }
              return next;
            });
            setAuthMenuOpen(null);
          }}
          className="p-2 rounded-md bg-white/5"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6H20" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M4 12H20" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M4 18H20" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div id="operation-keys" ref={authActionsRef} className="hidden md:flex gap-4">
        {HEADER_ACTIONS.map(({ label, route }) => {
          const isActive = active === label;
          const authAction = isAuthAction(label) ? label : null;
          const isOpen = authAction ? authMenuOpen === authAction : false;

          return (
            <div key={label} className="relative">
              <button
                className={`
                px-4 py-2 rounded-full cursor-pointer text-white
                transition-all duration-500 flex items-center gap-1.5
                ${isActive
                    ? "bg-gray-600 hover:bg-linear-to-br from-gray-950 to-gray-600"
                    : "bg-transparent"
                  }
              `}
                onMouseEnter={() => setActive(label)}
                onMouseLeave={() => setActive("Register")}
                onFocus={() => setActive(label)}
                onBlur={() => setActive("Register")}
                onClick={() => {
                  if (authAction) {
                    setAuthMenuOpen((current) =>
                      current === authAction ? null : authAction,
                    );
                    return;
                  }
                  setAuthMenuOpen(null);
                  router.push(route);
                }}
              >
                <span>{label}</span>
                {authAction && (
                  <Icon
                    icon={
                      isOpen
                        ? "solar:alt-arrow-up-line-duotone"
                        : "solar:alt-arrow-down-line-duotone"
                    }
                    height={16}
                  />
                )}
              </button>

              {authAction && isOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-xl border border-white/15 bg-black/85 backdrop-blur-md shadow-2xl overflow-hidden">
                  {AUTH_OPTIONS[authAction].map(({ label: optionLabel, route: optionRoute, hint }) => (
                    <button
                      key={optionRoute}
                      className="w-full text-left px-4 py-3 transition-colors duration-200 hover:bg-white/10"
                      onClick={() => {
                        setAuthMenuOpen(null);
                        router.push(optionRoute);
                      }}
                    >
                      <p className="text-sm font-medium text-white">{optionLabel}</p>
                      <p className="text-xs text-white/60">{hint}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={`md:hidden absolute top-full left-0 w-full z-40 ${mobileOpen ? "block" : "hidden"}`}>
        <div style={{ background: "var(--card)", borderTop: "1px solid var(--border)" }} className="p-4">
          <nav className="flex flex-col gap-2">
            {HEADER_NAV_LINKS.map(({ label, href, icon }) => (
              <Link
                key={label}
                href={href}
                onClick={() => {
                  setMobileOpen(false);
                  setMobileAuthMenuOpen(null);
                  setAuthMenuOpen(null);
                }}
              >
                <div className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100/5">
                  <Icon icon={icon} width={18} />
                  <span>{label}</span>
                </div>
              </Link>
            ))}
          </nav>

          <div className="mt-3 flex flex-col gap-2">
            {HEADER_ACTIONS.map(({ label, route }) => {
              const authAction = isAuthAction(label) ? label : null;
              const isOpen = authAction ? mobileAuthMenuOpen === authAction : false;

              if (!authAction) {
                return (
                  <button
                    key={label}
                    onClick={() => {
                      setMobileOpen(false);
                      setMobileAuthMenuOpen(null);
                      router.push(route);
                    }}
                    style={{ background: "var(--primary)", color: "#fff" }}
                    className="w-full text-left px-3 py-2 rounded-md"
                  >
                    {label}
                  </button>
                );
              }

              return (
                <div key={label} className="rounded-md overflow-hidden border border-white/10">
                  <button
                    onClick={() =>
                      setMobileAuthMenuOpen((current) =>
                        current === authAction ? null : authAction,
                      )
                    }
                    style={{ background: "var(--primary)", color: "#fff" }}
                    className="w-full text-left px-3 py-2 flex items-center justify-between"
                  >
                    <span>{label}</span>
                    <Icon
                      icon={
                        isOpen
                          ? "solar:alt-arrow-up-line-duotone"
                          : "solar:alt-arrow-down-line-duotone"
                      }
                      width={16}
                    />
                  </button>

                  {isOpen && (
                    <div className="bg-black/30">
                      {AUTH_OPTIONS[authAction].map(({ label: optionLabel, route: optionRoute, hint }) => (
                        <button
                          key={optionRoute}
                          className="w-full text-left px-3 py-2 border-t border-white/10"
                          onClick={() => {
                            setMobileAuthMenuOpen(null);
                            setMobileOpen(false);
                            router.push(optionRoute);
                          }}
                        >
                          <p className="text-sm text-white">{optionLabel}</p>
                          <p className="text-xs text-white/60">{hint}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <button
              onClick={() => {
                setMobileOpen(false);
                setMobileAuthMenuOpen(null);
                toggle();
              }}
              style={{ border: "1px solid var(--border)" }}
              className="w-full text-left px-3 py-2 rounded-md text-sm"
            >
              Toggle theme
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
