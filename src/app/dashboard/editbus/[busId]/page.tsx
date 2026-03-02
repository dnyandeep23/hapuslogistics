"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/redux/hooks";
import AdminBusForm from "@/components/admin/AdminBusForm";

export default function EditBusPage() {
  const { user } = useAppSelector((state) => state.user);
  const router = useRouter();
  const params = useParams<{ busId: string }>();
  const busId = String(params?.busId ?? "");
  const isAdmin = user?.role === "admin" || user?.isSuperAdmin;

  if (!isAdmin) {
    router.replace("/dashboard");
    return null;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px] space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#F6FF6A]">Edit Bus</h1>
        <p className="mt-1 text-sm text-white/70">Update bus details and route-point pricing.</p>
      </div>
      <AdminBusForm
        mode="edit"
        busId={busId}
        cancelHref="/dashboard/buses"
        successHref="/dashboard/buses"
      />
    </div>
  );
}
