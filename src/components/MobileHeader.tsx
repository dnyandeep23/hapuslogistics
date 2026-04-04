"use client";
import React from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { usePathname, useRouter } from "next/navigation";
import applogo from "@/assets/images/applogo.png";
import { useAppSelector } from "@/lib/redux/hooks";
import { STRINGS } from "@/lib/strings";

export default function MobileHeader() {
  const { user } = useAppSelector((state) => state.user);
  const pathname = usePathname();
  const router = useRouter();

  const sectionMeta = React.useMemo(() => {
    if (pathname.startsWith("/dashboard/orders")) {
      return { title: "Orders", subtitle: "Track shipments and review live updates." };
    }
    if (pathname.startsWith("/dashboard/buses")) {
      return { title: "Fleet", subtitle: "Manage buses, operators, and routes." };
    }
    if (pathname.startsWith("/dashboard/locations")) {
      return { title: "Locations", subtitle: "Maintain service regions and map pins." };
    }
    if (pathname.startsWith("/dashboard/users")) {
      return { title: "People", subtitle: "Operator approvals and company requests." };
    }
    if (pathname.startsWith("/dashboard/profile")) {
      return { title: "Profile", subtitle: "Keep your workspace details up to date." };
    }
    if (pathname.startsWith("/dashboard/pricing")) {
      return { title: "Revenue", subtitle: "Monitor pricing and settlement insights." };
    }
    if (pathname.startsWith("/dashboard/support")) {
      return { title: "Support", subtitle: "Review help requests and response status." };
    }
    return { title: "Dashboard", subtitle: "Your mobile workspace." };
  }, [pathname]);

  return (
    <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[linear-gradient(180deg,rgba(20,26,19,0.84),rgba(15,20,14,0.9))] px-4 py-3 backdrop-blur-xl lg:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <Image src={applogo} alt={STRINGS.brand.logoAlt} width={32} height={32} className="h-8 w-auto object-contain" priority onClick={() => { router.push('/dashboard') }} />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Workspace</p>
          <p className="truncate text-sm font-semibold text-[#F6FF6A]">{sectionMeta.title}</p>
          <p className="truncate text-[11px] text-white/50">{sectionMeta.subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* <button type="button" className="relative flex h-8 w-8 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#C5D2AC] shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-transform active:scale-95">
          <Icon icon="mdi:bell-outline" className="text-lg" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#d5e400]" />
        </button> */}
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#d5e400,#8fa82f)] text-xs font-bold text-[#14210d] shadow-[0_4px_12px_rgba(213,228,0,0.2)]" onClick={() => { router.push('/dashboard/profile') }}>
          {user?.name?.[0]?.toUpperCase() ?? "U"}
        </div>
      </div>
    </div>
  );
}
