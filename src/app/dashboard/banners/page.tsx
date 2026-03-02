"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { useAppSelector } from "@/lib/redux/hooks";
import SuperAdminCouponBannerSection from "@/components/dashboard/SuperAdminCouponBannerSection";

export default function DashboardBannersPage() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.user);

  useEffect(() => {
    if (!user) return;
    if (!user.isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [router, user]);

  if (!user || !user.isSuperAdmin) {
    return (
      <div className="rounded-2xl border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-200">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:shield-alert-outline" className="text-lg" />
          Access restricted to super admin.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#E4E67A]">Banner Center</h1>
        <p className="mt-1 text-sm text-white/70">
          Upload and manage active banner images for dashboard home carousel.
        </p>
      </div>
      <SuperAdminCouponBannerSection mode="banner" />
    </div>
  );
}
