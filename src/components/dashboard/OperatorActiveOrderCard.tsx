"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import Skeleton from "@/components/Skeleton";
import { useToast } from "@/context/ToastContext";

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

export type OperatorOrderBuckets = {
  activeOrders: OperatorActiveOrder[];
  upcomingOrders: OperatorActiveOrder[];
  pastOrders: OperatorActiveOrder[];
  processedCount: number;
};

type Props = {
  ordersByStage: OperatorOrderBuckets;
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
  showOnlyActive?: boolean;
};

type ProofType = "pickup" | "drop";

const getStatusBadge = (status: string): string => {
  const normalized = status.toLowerCase();
  if (normalized === "delivered") return "bg-green-500/20 text-green-300 border-green-500/40";
  if (normalized === "in-transit") return "bg-blue-500/20 text-blue-300 border-blue-500/40";
  if (normalized === "cancelled") return "bg-red-500/20 text-red-300 border-red-500/40";
  return "bg-amber-500/20 text-amber-300 border-amber-500/40";
};

const toDialablePhone = (value: string | undefined) =>
  String(value ?? "").trim().replace(/[^\d+]/g, "");

const formatOrderDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function OperatorActiveOrderCard({
  ordersByStage,
  loading,
  error,
  onRefresh,
  showOnlyActive = false,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);
  const [proofCaptureTarget, setProofCaptureTarget] = useState<{ orderId: string; proofType: ProofType } | null>(null);
  const [uploadingProofOrderId, setUploadingProofOrderId] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [isMobileOrTabletDevice, setIsMobileOrTabletDevice] = useState(false);
  const { addToast } = useToast();

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredOrders = useMemo(() => {
    const matchesSearch = (order: OperatorActiveOrder) => {
      if (!normalizedSearchQuery) return true;
      const searchableText = [
        order.trackingId,
        order.sender?.name,
        order.receiver?.name,
        order.pickupLocation?.name,
        order.dropLocation?.name,
      ]
        .map((value) => String(value ?? "").trim())
        .join(" ")
        .toLowerCase();
      return searchableText.includes(normalizedSearchQuery);
    };

    return {
      activeOrders: ordersByStage.activeOrders.filter(matchesSearch),
      upcomingOrders: ordersByStage.upcomingOrders.filter(matchesSearch),
      pastOrders: ordersByStage.pastOrders.filter(matchesSearch),
    };
  }, [
    normalizedSearchQuery,
    ordersByStage.activeOrders,
    ordersByStage.pastOrders,
    ordersByStage.upcomingOrders,
  ]);

  const totalVisibleOrders = showOnlyActive
    ? filteredOrders.activeOrders.length
    : filteredOrders.activeOrders.length +
      filteredOrders.upcomingOrders.length +
      filteredOrders.pastOrders.length;

  const stopCameraStream = useCallback(() => {
    setCameraStream((previous) => {
      if (previous) {
        previous.getTracks().forEach((track) => track.stop());
      }
      return null;
    });
    if (cameraPreviewRef.current) {
      cameraPreviewRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!expandedOrderId) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setExpandedOrderId(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [expandedOrderId]);

  useEffect(() => {
    setExpandedOrderId(null);
  }, [normalizedSearchQuery]);

  useEffect(() => {
    const evaluateDeviceType = () => {
      if (typeof window === "undefined" || typeof navigator === "undefined") {
        setIsMobileOrTabletDevice(false);
        return;
      }

      const userAgent = navigator.userAgent.toLowerCase();
      const hasMobileAgent =
        /android|iphone|ipad|ipod|mobile|tablet|silk|kindle|playbook/.test(userAgent);
      const isIpadDesktopMode = /macintosh/.test(userAgent) && navigator.maxTouchPoints > 1;
      const hasCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      const maxViewportSide = Math.max(window.innerWidth, window.innerHeight);
      const likelyTouchTablet = hasCoarsePointer && maxViewportSide <= 1366;

      setIsMobileOrTabletDevice(hasMobileAgent || isIpadDesktopMode || likelyTouchTablet);
    };

    evaluateDeviceType();
    window.addEventListener("resize", evaluateDeviceType);
    return () => window.removeEventListener("resize", evaluateDeviceType);
  }, []);

  useEffect(() => {
    if (!cameraStream || !cameraPreviewRef.current) return;
    cameraPreviewRef.current.srcObject = cameraStream;
    void cameraPreviewRef.current.play().catch(() => {});
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const getNextProofType = (order: OperatorActiveOrder): ProofType | null => {
    const status = String(order.status ?? "").trim().toLowerCase();
    if (status === "cancelled" || status === "delivered") return null;

    const hasPickupProof = Boolean(String(order.pickupProofImage ?? "").trim());
    const hasDropProof = Boolean(String(order.dropProofImage ?? "").trim());

    if (!hasPickupProof) return "pickup";
    if (!hasDropProof && status === "in-transit") return "drop";
    return null;
  };

  const closeProofCamera = useCallback(() => {
    stopCameraStream();
    setProofCaptureTarget(null);
    setCameraError("");
  }, [stopCameraStream]);

  const openProofCamera = async (orderId: string, proofType: ProofType) => {
    setCameraError("");

    if (isMobileOrTabletDevice === false) {
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setCameraError("Camera access is not available on this device.");
      return;
    }

    try {
      stopCameraStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { exact: "environment" },
        },
      });

      setProofCaptureTarget({ orderId, proofType });
      setCameraStream(stream);
    } catch {
      setProofCaptureTarget(null);
      setCameraError("Back camera not detected. Login from a mobile/tablet device with a rear camera.");
    }
  };

  const captureAndUploadProof = async () => {
    if (!proofCaptureTarget || !cameraPreviewRef.current) return;

    const videoElement = cameraPreviewRef.current;
    const frameWidth = videoElement.videoWidth;
    const frameHeight = videoElement.videoHeight;
    if (!frameWidth || !frameHeight) {
      setCameraError("Camera preview is not ready. Please wait for the stream and try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const context2d = canvas.getContext("2d");
    if (!context2d) {
      setCameraError("Unable to process camera frame.");
      return;
    }

    context2d.drawImage(videoElement, 0, 0, frameWidth, frameHeight);
    const capturedBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );

    if (!capturedBlob) {
      setCameraError("Failed to capture image. Please try again.");
      return;
    }

    try {
      setUploadingProofOrderId(proofCaptureTarget.orderId);
      const formData = new FormData();
      formData.append("proofType", proofCaptureTarget.proofType);
      formData.append(
        "image",
        new File(
          [capturedBlob],
          `${proofCaptureTarget.proofType}-proof-${Date.now()}.jpg`,
          { type: "image/jpeg" },
        ),
      );

      const response = await fetch(`/api/operator/orders/${proofCaptureTarget.orderId}/proof`, {
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
      closeProofCamera();
    } catch (proofError: unknown) {
      addToast(proofError instanceof Error ? proofError.message : "Failed to upload proof image.", "error");
    } finally {
      setUploadingProofOrderId(null);
    }
  };

  const renderOrderCard = (
    order: OperatorActiveOrder,
    stageLabel: "Active" | "Upcoming" | "Past",
    stageToneClass: string,
  ) => {
    const senderPhoneLink = toDialablePhone(order.sender?.phone);
    const receiverPhoneLink = toDialablePhone(order.receiver?.phone);
    const isExpanded = expandedOrderId === order.id;
    const nextProofType = getNextProofType(order);
    const isUploadingProof = uploadingProofOrderId === order.id;

    return (
      <article key={order.id} className="rounded-xl border border-white/15 bg-[#1b2418] p-4">
        <button
          type="button"
          onClick={() => setExpandedOrderId((prev) => (prev === order.id ? null : order.id))}
          className="flex w-full items-start justify-between gap-3 text-left"
          aria-expanded={isExpanded}
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <p className="font-mono text-sm text-[#E4E67A]">{order.trackingId}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stageToneClass}`}>
                {stageLabel}
              </span>
            </div>
            <p className="text-xs text-white/70">
              {order.pickupLocation.name} to {order.dropLocation.name}
            </p>
            <p className="text-[11px] text-white/55">
              {formatOrderDate(order.orderDate)} | Sender: {order.sender?.name || "--"} | Receiver: {" "}
              {order.receiver?.name || "--"}
            </p>
          </div>

          <div className="mt-0.5 flex items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${getStatusBadge(order.status)}`}
            >
              {order.status}
            </span>
            <Icon
              icon="mdi:chevron-down"
              className={`text-xl text-white/75 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        {isExpanded ? (
          <div className="mt-3 border-t border-white/10 pt-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="text-xs text-white/70">
                <span className="text-white/45">Sender:</span> {order.sender?.name || "--"} ({order.sender?.phone || "N/A"})
              </p>
              <p className="text-xs text-white/70">
                <span className="text-white/45">Receiver:</span> {order.receiver?.name || "--"} ({order.receiver?.phone || "N/A"})
              </p>
              <p className="text-xs text-white/70">
                <span className="text-white/45">Bus:</span> {order.bus?.busName || "--"} {order.bus?.busNumber ? `(${order.bus.busNumber})` : ""}
              </p>
              <p className="text-xs text-white/70">
                <span className="text-white/45">Date:</span> {formatOrderDate(order.orderDate)}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {showOnlyActive && stageLabel === "Active" && nextProofType ? (
                <button
                  type="button"
                  disabled={isUploadingProof || isMobileOrTabletDevice === false}
                  onClick={() => openProofCamera(order.id, nextProofType)}
                  className="inline-flex items-center gap-1 rounded-md border border-cyan-400/55 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
                >
                  <Icon icon={isUploadingProof ? "line-md:loading-loop" : "mdi:camera-outline"} className="text-sm" />
                  {isUploadingProof
                    ? "Uploading..."
                    : nextProofType === "pickup"
                      ? "Capture Pickup"
                      : "Capture Drop"}
                </button>
              ) : null}
              {senderPhoneLink ? (
                <a
                  href={`tel:${senderPhoneLink}`}
                  className="inline-flex items-center gap-1 rounded-md border border-green-500/55 px-2.5 py-1.5 text-xs font-medium text-green-300 hover:bg-green-500/15"
                >
                  <Icon icon="mdi:phone" className="text-sm" />
                  Sender
                </a>
              ) : null}
              {receiverPhoneLink ? (
                <a
                  href={`tel:${receiverPhoneLink}`}
                  className="inline-flex items-center gap-1 rounded-md border border-red-500/55 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/15"
                >
                  <Icon icon="mdi:phone" className="text-sm" />
                  Receiver
                </a>
              ) : null}
              {order.pickupProofImage ? (
                <a
                  href={order.pickupProofImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-cyan-500/55 px-2.5 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/15"
                >
                  <Icon icon="mdi:camera" className="text-sm" />
                  Pickup Proof
                </a>
              ) : null}
              {order.dropProofImage ? (
                <a
                  href={order.dropProofImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-violet-500/55 px-2.5 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-500/15"
                >
                  <Icon icon="mdi:camera" className="text-sm" />
                  Drop Proof
                </a>
              ) : null}
            </div>

            {order.operatorNote ? (
              <p className="mt-3 border-l-2 border-amber-300/50 pl-3 text-xs text-amber-100/90">
                {order.operatorNote}
              </p>
            ) : null}
            {showOnlyActive && stageLabel === "Active" && nextProofType && isMobileOrTabletDevice === false ? (
              <div className="mt-3 rounded-lg border border-amber-400/60 bg-amber-500/15 px-3 py-2 text-xs text-amber-100">
                Capture is disabled on desktop. Login from a mobile/tablet with rear camera.
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  };

  const renderSection = ({
    title,
    subtitle,
    sectionToneClass,
    stageLabel,
    orders,
    emptyMessage,
  }: {
    title: string;
    subtitle: string;
    sectionToneClass: string;
    stageLabel: "Active" | "Upcoming" | "Past";
    orders: OperatorActiveOrder[];
    emptyMessage: string;
  }) => (
    <div className="space-y-3">
      <div className="mb-1 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#f1f4aa]">{title}</h3>
          <p className="text-[11px] text-white/55">{subtitle}</p>
        </div>
        <span className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-white/75">
          {orders.length}
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/60">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2">{orders.map((order) => renderOrderCard(order, stageLabel, sectionToneClass))}</div>
      )}
    </div>
  );

  const noOrdersAvailable = showOnlyActive
    ? ordersByStage.activeOrders.length === 0
    : ordersByStage.activeOrders.length === 0 &&
      ordersByStage.upcomingOrders.length === 0 &&
      ordersByStage.pastOrders.length === 0;

  return (
    <section className="space-y-4" ref={rootRef}>
      <div className="rounded-2xl border border-[#4e573f]/70 bg-[#1a2117] p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[#E4E67A]">Operator Orders</h2>
            <p className="text-xs text-white/55">
              {showOnlyActive
                ? "Showing active orders for today's trip. Expand a tile using the arrow for full details."
                : "Active shows today's trip only. Expand a tile using the arrow for full details."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-[#e4e67a]/40 bg-[#e4e67a]/10 px-2 py-0.5 text-[#f1f4aa]">
                Active Today: {ordersByStage.activeOrders.length}
              </span>
              {!showOnlyActive ? (
                <>
                  <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-sky-200">
                    Upcoming: {ordersByStage.upcomingOrders.length}
                  </span>
                  <span className="rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-white/75">
                    Past: {ordersByStage.pastOrders.length}
                  </span>
                  <span className="rounded-full border border-emerald-400/45 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
                    Processed: {ordersByStage.processedCount}
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon icon="mdi:refresh" className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`operator-active-order-skeleton-${index}`}
                className="rounded-xl border border-white/15 bg-black/25 p-3"
              >
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-52" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-8 w-28" />
                    <Skeleton className="h-8 w-28" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        ) : noOrdersAvailable ? (
          <div className="rounded-xl border border-white/15 bg-black/25 p-4 text-sm text-white/70">
            No orders are assigned in your current operator period.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <label className="mb-2 block text-xs uppercase tracking-wide text-white/50">Search Orders</label>
              <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/25 px-3 py-2">
                <Icon icon="mdi:magnify" className="text-lg text-white/60" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search tracking ID, sender name, receiver name..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/45"
                />
              </div>
            </div>

            {totalVisibleOrders === 0 ? (
              <div className="rounded-xl border border-white/15 bg-black/25 p-4 text-sm text-white/70">
                No {showOnlyActive ? "active " : ""}orders matched <span className="font-medium text-white">{searchQuery}</span>.
              </div>
            ) : (
              showOnlyActive ? (
                <div className="space-y-2">
                  {filteredOrders.activeOrders.map((order) =>
                    renderOrderCard(order, "Active", "border-[#e4e67a]/45 bg-[#e4e67a]/10 text-[#f1f4aa]"),
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {renderSection({
                    title: "Active Orders",
                    subtitle: "Today's trip assignments",
                    sectionToneClass: "border-[#e4e67a]/45 bg-[#e4e67a]/10 text-[#f1f4aa]",
                    stageLabel: "Active",
                    orders: filteredOrders.activeOrders,
                    emptyMessage: "No active orders for today.",
                  })}
                  {renderSection({
                    title: "Upcoming Orders",
                    subtitle: "Scheduled for upcoming trip dates",
                    sectionToneClass: "border-sky-400/45 bg-sky-500/10 text-sky-200",
                    stageLabel: "Upcoming",
                    orders: filteredOrders.upcomingOrders,
                    emptyMessage: "No upcoming orders right now.",
                  })}
                  {renderSection({
                    title: "Past Orders",
                    subtitle: "Completed or previous date assignments",
                    sectionToneClass: "border-white/30 bg-white/10 text-white/80",
                    stageLabel: "Past",
                    orders: filteredOrders.pastOrders,
                    emptyMessage: "No past orders available.",
                  })}
                </div>
              )
            )}
          </div>
        )}
      </div>
      {proofCaptureTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          onClick={closeProofCamera}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#1a2117] p-4"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Capture order proof"
          >
            <h3 className="text-sm font-semibold text-[#E4E67A]">
              {proofCaptureTarget.proofType === "pickup" ? "Capture Pickup Proof" : "Capture Drop Proof"}
            </h3>
            <p className="mt-1 text-xs text-white/65">Rear camera only. File upload is disabled.</p>

            <div className="mt-3 overflow-hidden rounded-xl border border-white/15 bg-black">
              <video
                ref={cameraPreviewRef}
                autoPlay
                muted
                playsInline
                className="h-72 w-full object-cover"
              />
            </div>

            {cameraError ? (
              <p className="mt-3 rounded-lg border border-red-500/45 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {cameraError}
              </p>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeProofCamera}
                className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={captureAndUploadProof}
                disabled={uploadingProofOrderId === proofCaptureTarget.orderId}
                className="flex-1 rounded-lg border border-cyan-400/55 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadingProofOrderId === proofCaptureTarget.orderId ? "Uploading..." : "Capture"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
