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
  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    router.replace("/dashboard");
    return null;
  }

  return (
    <section className="relative w-full max-w-7xl mx-auto space-y-6">
      <AdminBusForm
        mode="edit"
        busId={busId}
        cancelHref="/dashboard/buses"
        successHref="/dashboard/buses"
      />
    </section>
  );
}
