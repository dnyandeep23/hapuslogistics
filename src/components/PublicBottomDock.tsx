"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";

type DockItem = {
  href: string;
  label: string;
  icon: string;
};

const PRIMARY_ITEMS: DockItem[] = [
  { href: "/", label: "Home", icon: "solar:home-angle-2-linear" },
  { href: "/about", label: "About", icon: "solar:buildings-2-outline" },
  { href: "/package", label: "Book", icon: "solar:box-minimalistic-linear" },
  { href: "/contact", label: "Support", icon: "solar:headphones-round-linear" },
];

const SECONDARY_ITEMS: DockItem[] = [
  { href: "/pricing", label: "Pricing", icon: "solar:wallet-money-linear" },
  { href: "/terms", label: "Terms", icon: "solar:document-text-linear" },
  { href: "/privacy", label: "Privacy", icon: "solar:shield-check-linear" },
  { href: "/refunds", label: "Refunds", icon: "solar:refresh-square-linear" },
];

function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function PublicBottomDock() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const moreActive = useMemo(
    () => SECONDARY_ITEMS.some((item) => isActivePath(pathname, item.href)),
    [pathname],
  );

  return (
    <>
      <div className="fixed inset-x-0 bottom-4 z-50 px-3 lg:hidden">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(248,250,241,0.12),rgba(14,20,12,0.9))] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
          <nav className="grid grid-cols-5 gap-2" aria-label="Public navigation">
            {PRIMARY_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-w-0 flex-col items-center justify-center rounded-[1.35rem] px-2 py-2.5 text-center transition ${
                    active
                      ? "bg-[linear-gradient(135deg,rgba(213,228,0,0.22),rgba(255,255,255,0.08))] text-[#f6ff6a]"
                      : "text-white/62 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                    active ? "bg-[#d5e400]/18" : "bg-white/6"
                  }`}>
                    <Icon icon={item.icon} className="text-[1.15rem]" />
                  </span>
                  <span className="mt-1.5 text-[11px] font-medium tracking-tight">{item.label}</span>
                </Link>
              );
            })}

            <button
              type="button"
              onClick={() => setIsMoreOpen(true)}
              className={`flex min-w-0 flex-col items-center justify-center rounded-[1.35rem] px-2 py-2.5 text-center transition ${
                moreActive
                  ? "bg-[linear-gradient(135deg,rgba(213,228,0,0.22),rgba(255,255,255,0.08))] text-[#f6ff6a]"
                  : "text-white/62 hover:bg-white/8 hover:text-white"
              }`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                moreActive ? "bg-[#d5e400]/18" : "bg-white/6"
              }`}>
                <Icon icon="solar:widget-5-linear" className="text-[1.15rem]" />
              </span>
              <span className="mt-1.5 text-[11px] font-medium tracking-tight">More</span>
            </button>
          </nav>
        </div>
      </div>

      {isMoreOpen ? (
        <>
          <button
            type="button"
            aria-label="Close public navigation"
            onClick={() => setIsMoreOpen(false)}
            className="fixed inset-0 z-[58] bg-black/55 backdrop-blur-[2px] lg:hidden"
          />

          <aside
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-3 bottom-28 z-[59] rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(27,36,22,0.98),rgba(12,18,10,0.98))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl lg:hidden"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/48">Explore</p>
                <h2 className="mt-1 text-lg font-semibold text-[#f6ff6a]">Quick links</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/82"
                aria-label="Close quick links"
              >
                <Icon icon="mdi:close" className="text-xl" />
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {SECONDARY_ITEMS.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    className={`flex items-center gap-3 rounded-[1.35rem] border px-3 py-3 text-sm transition ${
                      active
                        ? "border-[#d5e400]/20 bg-[#d5e400]/10 text-[#f6ff6a]"
                        : "border-white/8 bg-white/4 text-white/78 hover:bg-white/8"
                    }`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/20">
                      <Icon icon={item.icon} className="text-lg" />
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
