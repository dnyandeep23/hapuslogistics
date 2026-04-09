"use client";
import React from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { usePathname, useRouter } from "next/navigation";
import applogo from "@/assets/images/applogo.png";
import { useAppSelector } from "@/lib/redux/hooks";
import { STRINGS } from "@/lib/strings";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function MobileHeader() {
  const { user } = useAppSelector((state) => state.user);
  const pathname = usePathname();
  const router = useRouter();
  const { t, language, setLanguage } = useTranslation();

  const sectionMeta = React.useMemo(() => {
    if (pathname.startsWith("/dashboard/orders")) {
      return { title: t.nav.orders, subtitle: t.nav.ordersSubtitle };
    }
    if (pathname.startsWith("/dashboard/buses")) {
      return { title: t.nav.fleet, subtitle: t.nav.fleetSubtitle };
    }
    if (pathname.startsWith("/dashboard/locations")) {
      return { title: t.nav.locations, subtitle: t.nav.locationsSubtitle };
    }
    if (pathname.startsWith("/dashboard/users")) {
      return { title: t.nav.people, subtitle: t.nav.peopleSubtitle };
    }
    if (pathname.startsWith("/dashboard/profile")) {
      return { title: t.nav.profile, subtitle: t.nav.profileSubtitle };
    }
    if (pathname.startsWith("/dashboard/pricing")) {
      return { title: t.nav.revenue, subtitle: t.nav.revenueSubtitle };
    }
    if (pathname.startsWith("/dashboard/support")) {
      return { title: t.nav.support, subtitle: t.nav.supportSubtitle };
    }
    return { title: t.nav.dashboard, subtitle: t.nav.dashboardSubtitle };
  }, [pathname, t]);

  return (
    <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[linear-gradient(180deg,rgba(20,26,19,0.84),rgba(15,20,14,0.9))] px-4 py-3 backdrop-blur-xl lg:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <Image src={applogo} alt={t.brand.logoAlt} width={32} height={32} className="h-8 w-auto object-contain" priority onClick={() => { router.push('/dashboard') }} />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{t.nav.workspace}</p>
          <p className="truncate text-sm font-semibold text-[#F6FF6A]">{sectionMeta.title}</p>
          <p className="truncate text-[11px] text-white/50">{sectionMeta.subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#d5e400,#8fa82f)] text-xs font-bold text-[#14210d] shadow-[0_4px_12px_rgba(213,228,0,0.2)]" onClick={() => { router.push('/dashboard/profile') }}>
          {user?.name?.[0]?.toUpperCase() ?? "U"}
        </div>
      </div>
    </div>
  );
}
