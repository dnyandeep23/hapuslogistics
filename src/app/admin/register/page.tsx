"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import AuthShell from "@/components/AuthShell";

export default function AdminRegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/login");
  }, [router]);

  return (
    <AuthShell
      badge="Admin registration"
      title="Redirecting to secure admin access"
      description="Admin accounts are handled through the controlled login and verification flow to keep access consistent and protected."
      supportLine="If you were sent here in error, contact your system administrator."
      highlights={["Protected flow", "Secure verification", "Admin portal"]}
    >
      <div className="space-y-4 rounded-[1.25rem] border border-white/8 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#D5E400]/20 bg-[#D5E400]/10 text-[#F6FF6A]">
            <Icon icon="solar:shield-keyhole-bold-duotone" className="text-xl" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
              Redirecting
            </p>
            <p className="text-base font-semibold text-white">Admin login</p>
          </div>
        </div>
        <p className="text-sm leading-6 text-white/65">
          This page immediately routes to the admin login screen.
        </p>
      </div>
    </AuthShell>
  );
}
