"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Icon } from "@iconify/react";
import { useToast } from "@/context/ToastContext";
import Skeleton from "@/components/Skeleton";

export type OperatorActiveOrder = {
  id: string;
  trackingId: string;
  status: string;
  orderDate: string;
  pickupLocation: {
    name: string;
    city: string;
    state: string;
  };
  dropLocation: {
    name: string;
    city: string;
    state: string;
  };
  pickupProofImage?: string;
  dropProofImage?: string;
  operatorNote?: string;
  sender: {
    name: string;
    phone: string;
  };
  receiver: {
    name: string;
    phone: string;
  };
  bus: {
    id: string;
    busName: string;
    busNumber: string;
    busImage: string;
    operatorName: string;
    operatorPhone: string;
  };
};

type Props = {
  order: OperatorActiveOrder | null;
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
};

const getStatusBadge = (status: string): string => {
  const normalized = status.toLowerCase();
  if (normalized === "delivered") return "bg-green-500/20 text-green-300 border-green-500/40";
  if (normalized === "in-transit") return "bg-blue-500/20 text-blue-300 border-blue-500/40";
  if (normalized === "cancelled") return "bg-red-500/20 text-red-300 border-red-500/40";
  return "bg-amber-500/20 text-amber-300 border-amber-500/40";
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function OperatorActiveOrderCard({
  order,
  loading,
  error,
  onRefresh,
}: Props) {
  const { addToast } = useToast();
  const [uploadingType, setUploadingType] = useState<"pickup" | "drop" | null>(null);
  const [isDesktopLikeDevice, setIsDesktopLikeDevice] = useState(false);

  useEffect(() => {
    const evaluateDevice = () => {
      if (typeof window === "undefined") return;
      const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
      const hasHover = window.matchMedia("(hover: hover)").matches;
      const hasTouch =
        "ontouchstart" in window ||
        (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
      setIsDesktopLikeDevice(hasFinePointer && hasHover && !hasTouch);
    };

    evaluateDevice();
    window.addEventListener("resize", evaluateDevice);
    return () => window.removeEventListener("resize", evaluateDevice);
  }, []);

  const handleUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    proofType: "pickup" | "drop",
  ) => {
    if (isDesktopLikeDevice) {
      addToast(
        "Use a mobile/tablet with back camera to process pickup and drop verification.",
        "warning",
      );
      if (event.target) event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];
    if (!file || !order?.id) return;

    try {
      setUploadingType(proofType);
      const formData = new FormData();
      formData.append("proofType", proofType);
      formData.append("image", file);

      const response = await fetch(`/api/operator/orders/${order.id}/proof`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        addToast(payload?.message || "Failed to upload proof image.", "error");
        return;
      }

      addToast(payload?.message || "Proof uploaded successfully.", "success");
      await onRefresh();
    } catch (uploadError: unknown) {
      addToast(
        uploadError instanceof Error ? uploadError.message : "Failed to upload proof image.",
        "error",
      );
    } finally {
      setUploadingType(null);
      if (event.target) event.target.value = "";
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-[#4e573f] bg-[#1f251c] p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-[#E4E67A]">My Order</h2>
          {order?.status && (
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusBadge(
                order.status,
              )}`}
            >
              {order.status}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-black/25 p-3 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <div className="rounded-xl bg-black/25 p-3 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <div className="rounded-xl border border-white/15 bg-black/25 p-3 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-56" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={`operator-proof-skeleton-${index}`}
                  className="rounded-xl border border-white/15 bg-black/25 p-3 space-y-3"
                >
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-28 w-full rounded-lg" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-10 w-40" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        ) : !order ? (
          <div className="rounded-xl border border-white/15 bg-black/25 p-4 text-sm text-white/70">
            No active order is assigned for your current bus period.
          </div>
        ) : (
          <div className="space-y-4">
            {isDesktopLikeDevice && (
              <div className="rounded-xl border border-amber-400/45 bg-amber-400/10 p-3 text-sm text-amber-100">
                You are on desktop. To process pickup/drop verification, please login using a mobile or tablet
                device with a back camera.
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-black/25 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">Pickup</p>
                <p className="mt-1 font-medium text-white">{order.pickupLocation.name}</p>
                <p className="text-sm text-white/70">
                  {order.pickupLocation.city}, {order.pickupLocation.state}
                </p>
              </div>
              <div className="rounded-xl bg-black/25 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">Drop</p>
                <p className="mt-1 font-medium text-white">{order.dropLocation.name}</p>
                <p className="text-sm text-white/70">
                  {order.dropLocation.city}, {order.dropLocation.state}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/15 bg-black/25 p-3">
              <p className="text-xs uppercase tracking-wide text-white/50">Tracking</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/80">
                <span className="font-mono text-[#E4E67A]">{order.trackingId}</span>
                <span>Pickup date: {formatDate(order.orderDate)}</span>
              </div>
            </div>

            {order.operatorNote ? (
              <div className="rounded-xl border border-amber-300/45 bg-amber-500/10 p-3">
                <p className="text-xs uppercase tracking-wide text-amber-200">Admin Note</p>
                <p className="mt-1 text-sm text-amber-100/90">{order.operatorNote}</p>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/15 bg-black/25 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">Pickup Verification</p>
                {order.pickupProofImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={order.pickupProofImage}
                    alt="Pickup proof"
                    className="mt-2 h-28 w-full rounded-lg border border-white/20 object-cover"
                  />
                ) : (
                  <p className="mt-2 text-sm text-white/70">Open camera and capture pickup proof image.</p>
                )}
                <p className="mt-2 text-xs text-white/55">
                  Once uploaded, proof image is confirmed and cannot be changed.
                </p>
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#D5E400]/70 px-3 py-2 text-sm font-medium text-[#E4E67A] hover:bg-[#D5E400]/10">
                  <Icon icon="mdi:camera" />
                  {isDesktopLikeDevice
                    ? "Use Mobile/Tablet for Pickup"
                    : order.pickupProofImage
                      ? "Pickup Verified (Locked)"
                    : uploadingType === "pickup"
                      ? "Uploading..."
                      : "Open Camera (Pickup)"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={uploadingType !== null || isDesktopLikeDevice || Boolean(order.pickupProofImage)}
                    onChange={(event) => handleUpload(event, "pickup")}
                  />
                </label>
              </div>

              <div className="rounded-xl border border-white/15 bg-black/25 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">Drop Verification</p>
                {order.dropProofImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={order.dropProofImage}
                    alt="Drop proof"
                    className="mt-2 h-28 w-full rounded-lg border border-white/20 object-cover"
                  />
                ) : (
                  <p className="mt-2 text-sm text-white/70">Open camera and capture drop proof image.</p>
                )}
                <p className="mt-2 text-xs text-white/55">
                  Once uploaded, proof image is confirmed and cannot be changed.
                </p>
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#D5E400]/70 px-3 py-2 text-sm font-medium text-[#E4E67A] hover:bg-[#D5E400]/10">
                  <Icon icon="mdi:camera" />
                  {isDesktopLikeDevice
                    ? "Use Mobile/Tablet for Drop"
                    : order.dropProofImage
                      ? "Drop Verified (Locked)"
                    : uploadingType === "drop"
                      ? "Uploading..."
                      : "Open Camera (Drop)"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={
                      isDesktopLikeDevice ||
                      uploadingType !== null ||
                      Boolean(order.dropProofImage) ||
                      !order.pickupProofImage ||
                      order.status.toLowerCase() !== "in-transit"
                    }
                    onChange={(event) => handleUpload(event, "drop")}
                  />
                </label>
                {isDesktopLikeDevice ? (
                  <p className="mt-2 text-xs text-amber-300">
                    Verification upload is available only on mobile/tablet with back camera.
                  </p>
                ) : order.dropProofImage ? (
                  <p className="mt-2 text-xs text-emerald-300">
                    Drop proof confirmed. Changes are locked.
                  </p>
                ) : !order.pickupProofImage ? (
                  <p className="mt-2 text-xs text-amber-300">Capture pickup first to enable drop verification.</p>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
