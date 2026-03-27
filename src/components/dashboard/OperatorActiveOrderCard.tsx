"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import Skeleton from "@/components/Skeleton";
import ConfirmationModal from "@/components/dashboard/ConfirmationModal";
import { useToast } from "@/context/ToastContext";

export type OperatorActiveOrder = {
  id: string;
  trackingId: string;
  status: string;
  orderDate: string;
  pickupLocation: {
    id?: string;
    name: string;
    address?: string;
    city: string;
    state: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  dropLocation: {
    id?: string;
    name: string;
    address?: string;
    city: string;
    state: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  pickupProofImage?: string;
  dropProofImage?: string;
  operatorNote?: string;
  report?: IncidentReport | null;
  assignedOffice?: {
    officeName: string;
    address?: string;
    city: string;
    state: string;
    zip?: string;
    phone: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  routeMeta?: {
    pickupIndex?: number | null;
    dropIndex?: number | null;
    currentTask?: "pickup" | "drop";
    currentIndex?: number | null;
  };
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

type ProofType = "pickup" | "drop" | "office_drop";
type IncidentReportType = "customer_not_at_pickup" | "customer_not_at_drop";
type OperatorGeoPoint = {
  latitude: number;
  longitude: number;
};
type PermissionKind = "location" | "camera";
type BrowserPermissionState = "granted" | "prompt" | "denied" | "unsupported";
type PermissionModalState = {
  kind: PermissionKind;
  status: BrowserPermissionState;
  orderId?: string;
  proofType?: ProofType;
} | null;

type IncidentReport = {
  reportType?: IncidentReportType;
  category?: string;
  title?: string;
  description?: string;
  createdBy?: string;
  createdByRole?: string;
  createdAt?: string;
  data?: {
    note?: string;
    guidance?: string;
    processingStatus?: "attention_needed" | "office_collection_required";
    orderId?: string;
    busId?: string;
    officeAction?: string;
    customerMessage?: string;
    assignedOffice?: {
      officeName: string;
      address?: string;
      city: string;
      state: string;
      zip?: string;
      phone: string;
      latitude?: number | null;
      longitude?: number | null;
    };
    operatorLocation?: {
      latitude: number;
      longitude: number;
    };
  };
  type?: IncidentReportType;
  status?: "attention_needed" | "office_collection_required";
  note?: string;
  guidance?: string;
  reportedAt?: string;
  reportedBy?: string;
};

const getStatusBadge = (status: string): string => {
  const normalized = status.toLowerCase();
  if (normalized === "delivered") return "bg-green-500/20 text-green-300 border-green-500/40";
  if (normalized === "in-transit") return "bg-blue-500/20 text-blue-300 border-blue-500/40";
  if (normalized === "missed_package") return "bg-orange-500/20 text-orange-200 border-orange-400/40";
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

const toGeoPoint = (location: {
  latitude?: number | null;
  longitude?: number | null;
} | null | undefined): OperatorGeoPoint | null => {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
};

const calculateDistanceKm = (from: OperatorGeoPoint, to: OperatorGeoPoint): number => {
  const earthRadiusKm = 6371;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadiusKm * c).toFixed(1));
};

const getPermissionModalCopy = (kind: PermissionKind, status: BrowserPermissionState) => {
  const permissionLabel = kind === "location" ? "GPS access" : "camera access";

  if (status === "denied") {
    return {
      title: `Allow ${permissionLabel}`,
      description:
        `This browser has blocked ${permissionLabel} for this site. Open the lock icon or site settings, switch the permission to Allow, then retry from here.`,
      confirmLabel: "Retry Permission",
      helperText:
        "Most browsers stop showing the native permission popup after you tap Block once, so site settings are required before retrying.",
    };
  }

  if (status === "prompt") {
    return {
      title: `Allow ${permissionLabel}`,
      description:
        `Tap continue and choose Allow in the browser popup so the operator dashboard can use ${kind === "location" ? "live GPS sorting" : "proof capture"}.`,
      confirmLabel: "Continue",
      helperText: "The next step will trigger the browser permission dialog.",
    };
  }

  if (status === "granted") {
    return {
      title: `Use ${permissionLabel}`,
      description:
        `This browser is ready to use ${permissionLabel}. Continue to resume the ${kind === "location" ? "GPS lookup" : "camera capture"} flow.`,
      confirmLabel: "Continue",
      helperText: "",
    };
  }

  return {
    title: `Allow ${permissionLabel}`,
    description:
      `We could not confirm the current ${permissionLabel} state from this browser. Continue once to ask the browser for access.`,
    confirmLabel: "Request Access",
    helperText: "If no browser popup appears, check the site permission settings manually.",
  };
};

export default function OperatorActiveOrderCard({
  ordersByStage,
  loading,
  error,
  onRefresh,
  showOnlyActive = false,
}: Props) {
  const router = useRouter();
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
  const [incidentTarget, setIncidentTarget] = useState<{ orderId: string; type: IncidentReportType } | null>(null);
  const [selectedIncidentType, setSelectedIncidentType] = useState<IncidentReportType>("customer_not_at_pickup");
  const [incidentNote, setIncidentNote] = useState("");
  const [operatorLocation, setOperatorLocation] = useState<OperatorGeoPoint | null>(null);
  const [locationError, setLocationError] = useState("");
  const [locatingOperator, setLocatingOperator] = useState(false);
  const [reportingOrderId, setReportingOrderId] = useState<string | null>(null);
  const [permissionModal, setPermissionModal] = useState<PermissionModalState>(null);
  const [permissionActionLoading, setPermissionActionLoading] = useState(false);
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

    const sortByRouteAndOperatorLocation = (left: OperatorActiveOrder, right: OperatorActiveOrder) => {
      const leftRouteIndex = Number(left.routeMeta?.currentIndex ?? Number.MAX_SAFE_INTEGER);
      const rightRouteIndex = Number(right.routeMeta?.currentIndex ?? Number.MAX_SAFE_INTEGER);
      if (leftRouteIndex !== rightRouteIndex) return leftRouteIndex - rightRouteIndex;

      if (operatorLocation) {
        const leftTarget =
          left.routeMeta?.currentTask === "drop" ? toGeoPoint(left.dropLocation) : toGeoPoint(left.pickupLocation);
        const rightTarget =
          right.routeMeta?.currentTask === "drop" ? toGeoPoint(right.dropLocation) : toGeoPoint(right.pickupLocation);
        const leftDistance = leftTarget ? calculateDistanceKm(operatorLocation, leftTarget) : Number.MAX_SAFE_INTEGER;
        const rightDistance = rightTarget ? calculateDistanceKm(operatorLocation, rightTarget) : Number.MAX_SAFE_INTEGER;
        if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      }

      return new Date(left.orderDate).getTime() - new Date(right.orderDate).getTime();
    };

    return {
      activeOrders: [...ordersByStage.activeOrders.filter(matchesSearch)].sort(sortByRouteAndOperatorLocation),
      upcomingOrders: ordersByStage.upcomingOrders.filter(matchesSearch),
      pastOrders: ordersByStage.pastOrders.filter(matchesSearch),
    };
  }, [
    normalizedSearchQuery,
    operatorLocation,
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

  const getBrowserPermissionState = useCallback(
    async (kind: PermissionKind): Promise<BrowserPermissionState> => {
      if (
        typeof navigator === "undefined" ||
        !navigator.permissions ||
        typeof navigator.permissions.query !== "function"
      ) {
        return "unsupported";
      }

      try {
        const permissionName = kind === "location" ? "geolocation" : "camera";
        const result = await navigator.permissions.query({ name: permissionName as PermissionName });
        if (result.state === "granted" || result.state === "prompt" || result.state === "denied") {
          return result.state;
        }
      } catch {
        return "unsupported";
      }

      return "unsupported";
    },
    [],
  );

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

  const requestOperatorLocation = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("GPS sorting is not available on this device.");
      setPermissionModal({
        kind: "location",
        status: "unsupported",
      });
      return false;
    }

    setLocatingOperator(true);
    setLocationError("");
    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setOperatorLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLocationError("");
          setLocatingOperator(false);
          setPermissionModal((current) => (current?.kind === "location" ? null : current));
          resolve(true);
        },
        (error) => {
          void (async () => {
            const permissionState = await getBrowserPermissionState("location");
            if (error.code === error.PERMISSION_DENIED) {
              setLocationError(
                permissionState === "denied"
                  ? "GPS permission is blocked. Open your browser site settings and allow Location for this dashboard."
                  : "Please allow GPS access in the browser prompt to sort active orders.",
              );
              setPermissionModal({
                kind: "location",
                status: permissionState,
              });
            } else {
              setLocationError(error.message || "Unable to access your current location.");
            }
            setLocatingOperator(false);
            resolve(false);
          })();
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 60_000,
        },
      );
    });
  }, [getBrowserPermissionState]);

  useEffect(() => {
    void requestOperatorLocation();
  }, [requestOperatorLocation]);

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
    if (status === "cancelled" || status === "delivered" || status === "missed_package") return null;

    const hasPickupProof = Boolean(String(order.pickupProofImage ?? "").trim());
    const hasDropProof = Boolean(String(order.dropProofImage ?? "").trim());

    if (!hasPickupProof) {
        return order.report?.type === "customer_not_at_pickup" ? null : "pickup";
    }
    if (!hasDropProof && status === "in-transit") {
        return order.report?.type === "customer_not_at_drop" ? "office_drop" : "drop";
    }
    return null;
  };

  const getIncidentReportType = (order: OperatorActiveOrder): IncidentReportType | null => {
    const status = String(order.status ?? "").trim().toLowerCase();
    if (status === "cancelled" || status === "delivered" || status === "missed_package") return null;
    if (order.report) return null;

    if (status === "in-transit") {
      return "customer_not_at_drop";
    }

    if (status === "pending" || status === "confirmed" || status === "allocated") {
      return "customer_not_at_pickup";
    }

    return null;
  };

  const getAvailableIncidentTypes = (order: OperatorActiveOrder): IncidentReportType[] => {
    const status = String(order.status ?? "").trim().toLowerCase();
    if (status === "cancelled" || status === "delivered" || status === "missed_package" || order.report) {
      return [];
    }

    if (status === "in-transit") {
      return ["customer_not_at_drop", "customer_not_at_pickup"];
    }

    return ["customer_not_at_pickup", "customer_not_at_drop"];
  };

  const getIncidentReportCopy = (type: IncidentReportType) => {
    if (type === "customer_not_at_drop") {
      return {
        title: "Customer not at drop",
        description:
          "Use this when the receiver is unavailable at drop time. The incident will flag the order for office collection.",
        guidance: "Collect the package from office.",
        confirmLabel: "Report Drop Issue",
      };
    }

    return {
      title: "Customer not at pickup",
      description:
        "Use this when the sender is unavailable at pickup time. The incident will stay on the order for admin review.",
      guidance: "Hold the shipment and confirm with the customer before dispatch.",
      confirmLabel: "Report Pickup Issue",
    };
  };

  const submitIncidentReport = async () => {
    if (!incidentTarget) return;

    try {
      setReportingOrderId(incidentTarget.orderId);
      const response = await fetch("/api/operator/active-order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: incidentTarget.orderId,
          reportType: selectedIncidentType,
          note: incidentNote.trim(),
          operatorLocation,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        addToast(payload?.message || "Failed to submit incident report.", "error");
        return;
      }

      addToast(payload?.message || "Incident report submitted successfully.", "success");
      await onRefresh();
      setIncidentTarget(null);
      setIncidentNote("");
    } catch (reportError: unknown) {
      addToast(reportError instanceof Error ? reportError.message : "Failed to submit incident report.", "error");
    } finally {
      setReportingOrderId(null);
    }
  };

  const closeProofCamera = useCallback(() => {
    stopCameraStream();
    setProofCaptureTarget(null);
    setCameraError("");
  }, [stopCameraStream]);

  const openProofCamera = useCallback(async (
    orderId: string,
    proofType: ProofType,
    options?: { forcePrompt?: boolean },
  ): Promise<boolean> => {
    setCameraError("");

    if (isMobileOrTabletDevice === false) {
      setCameraError("Camera access is restricted to mobile and tablet devices.");
      return false;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setCameraError("Camera access is not available on this device.");
      setPermissionModal({
        kind: "camera",
        status: "unsupported",
        orderId,
        proofType,
      });
      return false;
    }

    if (!options?.forcePrompt) {
      const permissionState = await getBrowserPermissionState("camera");
      if (permissionState !== "granted") {
        setPermissionModal({
          kind: "camera",
          status: permissionState,
          orderId,
          proofType,
        });
        return false;
      }
    }

    try {
      stopCameraStream();
      let stream;
      try {
        // Try strict back camera first
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { exact: "environment" } },
        });
      } catch {
        // Fallback to any available camera if back camera is not found
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      }

      setProofCaptureTarget({ orderId, proofType });
      setCameraStream(stream);
      setPermissionModal((current) => (current?.kind === "camera" ? null : current));
      return true;
    } catch (err: unknown) {
      const permissionState = await getBrowserPermissionState("camera");
      setProofCaptureTarget(null);
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
        setCameraError(
          permissionState === "denied"
            ? "Camera permission is blocked. Open your browser site settings and allow Camera for this dashboard."
            : "Please allow camera access in the browser prompt to capture proof.",
        );
        setPermissionModal({
          kind: "camera",
          status: permissionState,
          orderId,
          proofType,
        });
      } else {
        setCameraError("Unable to access any camera on this device.");
      }
      return false;
    }
  }, [getBrowserPermissionState, isMobileOrTabletDevice, stopCameraStream]);

  const handleLocationPermissionClick = useCallback(async () => {
    const permissionState = await getBrowserPermissionState("location");
    if (permissionState !== "granted") {
      setPermissionModal({
        kind: "location",
        status: permissionState,
      });
      return;
    }

    await requestOperatorLocation();
  }, [getBrowserPermissionState, requestOperatorLocation]);

  const handlePermissionModalConfirm = useCallback(async () => {
    if (!permissionModal) return;

    setPermissionActionLoading(true);
    try {
      if (permissionModal.kind === "location") {
        await requestOperatorLocation();
        return;
      }

      if (!permissionModal.orderId || !permissionModal.proofType) {
        setPermissionModal(null);
        return;
      }

      await openProofCamera(permissionModal.orderId, permissionModal.proofType, { forcePrompt: true });
    } finally {
      setPermissionActionLoading(false);
    }
  }, [openProofCamera, permissionModal, requestOperatorLocation]);

  const permissionModalCopy = permissionModal
    ? getPermissionModalCopy(permissionModal.kind, permissionModal.status)
    : null;

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
    const incidentReportType = getIncidentReportType(order);
    const availableIncidentTypes = getAvailableIncidentTypes(order);
    const isUploadingProof = uploadingProofOrderId === order.id;
    const hasIncidentReport = Boolean(order.report);
    const activeTargetLocation =
      order.routeMeta?.currentTask === "drop" ? toGeoPoint(order.dropLocation) : toGeoPoint(order.pickupLocation);
    const distanceFromOperator =
      operatorLocation && activeTargetLocation
        ? calculateDistanceKm(operatorLocation, activeTargetLocation)
        : null;
    const assignedOffice = order.report?.data?.assignedOffice || order.assignedOffice;
    const dropMessage = order.report?.data?.customerMessage;
    const routeIndexLabel = Number.isFinite(Number(order.routeMeta?.currentIndex))
      ? `Stop ${order.routeMeta?.currentIndex}`
      : null;

    return (
      <article
        key={order.id}
        className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(145deg,rgba(239,243,165,0.08),rgba(17,21,14,0.88)_30%,rgba(7,10,7,0.96))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)] transition-all duration-300 hover:border-[#dbe46a]/25 hover:shadow-[0_22px_60px_rgba(0,0,0,0.28)] sm:p-5"
      >
        <button
          type="button"
          onClick={() => setExpandedOrderId((prev) => (prev === order.id ? null : order.id))}
          className="flex w-full items-start justify-between gap-3 text-left"
          aria-expanded={isExpanded}
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-sm text-[#E4E67A]">{order.trackingId}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stageToneClass}`}>
                {stageLabel}
              </span>
              {routeIndexLabel ? (
                <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
                  {routeIndexLabel}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-white/90">
              {order.pickupLocation.name} to {order.dropLocation.name}
            </p>
            <div className="flex flex-wrap gap-2 text-[11px] text-white/55">
              <span>{formatOrderDate(order.orderDate)}</span>
              <span>Sender: {order.sender?.name || "--"}</span>
              <span>Receiver: {order.receiver?.name || "--"}</span>
              {distanceFromOperator !== null ? (
                <span className="text-[#D8E57E]">{distanceFromOperator.toFixed(1)} km away</span>
              ) : null}
            </div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
              Next task: {order.routeMeta?.currentTask === "drop" ? order.dropLocation.name : order.pickupLocation.name}
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

        {isExpanded && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-white/50 mb-1">Sender</p>
                <p className="text-sm text-white">{order.sender?.name || "--"}</p>
                <p className="text-sm text-white/70">{order.sender?.phone || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1">Receiver</p>
                <p className="text-sm text-white">{order.receiver?.name || "--"}</p>
                <p className="text-sm text-white/70">{order.receiver?.phone || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1">Bus Details</p>
                <p className="text-sm text-white">{order.bus?.busName || "--"}</p>
                <p className="text-sm text-white/70">{order.bus?.busNumber ? `(${order.bus.busNumber})` : ""}</p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1">Order Date</p>
                <p className="text-sm text-white">{formatOrderDate(order.orderDate)}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {availableIncidentTypes.map((type) => (
                <span
                  key={`${order.id}-${type}`}
                  className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] text-white/70"
                >
                  {type === "customer_not_at_pickup" ? "Not at pickup" : "Not at drop"}
                </span>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {showOnlyActive && stageLabel === "Active" && nextProofType ? (
                <button
                  type="button"
                  disabled={isUploadingProof || isMobileOrTabletDevice === false}
                  onClick={() => openProofCamera(order.id, nextProofType)}
                  className="inline-flex items-center gap-2 rounded-md bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
                >
                  <Icon icon={isUploadingProof ? "line-md:loading-loop" : "mdi:camera-outline"} className="text-base" />
                  {isUploadingProof
                    ? "Uploading..."
                    : nextProofType === "pickup"
                      ? "Capture Pickup"
                      : nextProofType === "office_drop"
                        ? "Capture Office Drop"
                        : "Capture Drop"}
                </button>
              ) : null}
              {showOnlyActive && stageLabel === "Active" && incidentReportType ? (
                <button
                  type="button"
                  disabled={Boolean(hasIncidentReport)}
                  onClick={() => {
                    setSelectedIncidentType(incidentReportType);
                    setIncidentNote("");
                    setIncidentTarget({ orderId: order.id, type: incidentReportType });
                  }}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon icon="mdi:alert-circle-outline" className="text-base" />
                  {hasIncidentReport
                    ? "Incident Logged"
                    : "Report Issue"}
                </button>
              ) : null}
              {senderPhoneLink ? (
                <a
                  href={`tel:${senderPhoneLink}`}
                  className="inline-flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm font-medium text-green-300 hover:bg-green-500/20"
                >
                  <Icon icon="mdi:phone" className="text-base" />
                  Call Sender
                </a>
              ) : null}
              {receiverPhoneLink ? (
                <a
                  href={`tel:${receiverPhoneLink}`}
                  className="inline-flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20"
                >
                  <Icon icon="mdi:phone" className="text-base" />
                  Call Receiver
                </a>
              ) : null}
              {order.pickupProofImage ? (
                <a
                  href={order.pickupProofImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/20"
                >
                  <Icon icon="mdi:camera" className="text-base" />
                  View Pickup Proof
                </a>
              ) : null}
              {order.dropProofImage ? (
                <a
                  href={order.dropProofImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/20"
                >
                  <Icon icon="mdi:camera" className="text-base" />
                  View Drop Proof
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
              >
                <Icon icon="mdi:open-in-new" className="text-base" />
                {String(order.status).toLowerCase() === "missed_package" ? "Open Refund" : "View Order"}
              </button>
            </div>

            {order.report ? (
              <div className="mt-4 rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-amber-100">
                    Incident: {order.report.title || (order.report.reportType === "customer_not_at_drop" ? "Customer not at drop" : "Customer not at pickup")}
                  </p>
                  <span className="rounded-full border border-amber-300/40 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-100">
                    {order.report.data?.processingStatus === "office_collection_required" || order.report.status === "office_collection_required"
                      ? "Office collection"
                      : "Needs attention"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-amber-50/90">
                  {order.report.description || order.report.data?.guidance || order.report.guidance}
                </p>
                <p className="mt-1 text-xs text-amber-100/75">
                  {order.report.data?.note || order.report.note}
                </p>
                {assignedOffice ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-amber-50/85">
                    <p className="font-semibold text-amber-50">Assigned office</p>
                    <p className="mt-1">
                      {assignedOffice.officeName}, {assignedOffice.city}, {assignedOffice.state}
                    </p>
                    <p>{assignedOffice.phone}</p>
                  </div>
                ) : null}
                {dropMessage ? (
                  <p className="mt-2 text-xs text-amber-100/75">{dropMessage}</p>
                ) : null}
              </div>
            ) : null}

            {order.operatorNote && !order.report ? (
              <p className="mt-4 border-l-4 border-amber-400/50 pl-4 text-sm text-amber-200/90">
                {order.operatorNote}
              </p>
            ) : null}
            {showOnlyActive && stageLabel === "Active" && nextProofType && isMobileOrTabletDevice === false ? (
              <div className="mt-4 rounded-lg border border-amber-400/60 bg-amber-500/15 px-4 py-3 text-sm text-amber-100 font-medium">
                <Icon icon="mdi:desktop-mac" className="inline mr-2 text-lg" />
                Capture is disabled on desktop screens. Please use a mobile or tablet device to capture proof.
              </div>
            ) : null}
          </div>
        )}
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
        <div className="dashboard-surface-soft rounded-lg p-3 text-xs text-white/60">
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
    <section className="space-y-6" ref={rootRef}>
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(220,232,106,0.11),rgba(23,30,20,0.92)_34%,rgba(9,12,8,0.98))] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.22)] sm:p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D6E46E]">Live Operator Board</p>
            <h2 className="mt-2 text-2xl font-bold text-[#F2F6B8]">Operator Dashboard</h2>
            <p className="text-sm text-white/60 mt-1">
              {showOnlyActive
                ? "Showing active orders sorted by route progress and your latest GPS position."
                : "A summary of your active, upcoming, and past orders."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void handleLocationPermissionClick();
              }}
              disabled={locatingOperator}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-60"
            >
              <Icon icon={locatingOperator ? "line-md:loading-loop" : "mdi:crosshairs-gps"} className="text-base" />
              {locatingOperator ? "Locating..." : operatorLocation ? "Update GPS" : "Enable GPS Sort"}
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 rounded-full border border-[#dbe46a]/20 bg-[#dbe46a]/10 px-4 py-2 text-sm font-semibold text-[#F4FF9B] transition hover:bg-[#dbe46a]/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon icon="mdi:refresh" className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh Orders"}
            </button>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-xs text-white/75">
            GPS sorting: {operatorLocation ? "on" : "off"}
          </span>
          {locationError ? (
            <span className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs text-red-200">
              {locationError}
            </span>
          ) : null}
          {operatorLocation ? (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
              {operatorLocation.latitude.toFixed(4)}, {operatorLocation.longitude.toFixed(4)}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-center">
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.06] p-4">
            <p className="text-sm text-white/70">Active Today</p>
            <p className="text-2xl font-bold text-[#E4E67A]">{ordersByStage.activeOrders.length}</p>
          </div>
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.06] p-4">
            <p className="text-sm text-white/70">Upcoming</p>
            <p className="text-2xl font-bold text-sky-300">{ordersByStage.upcomingOrders.length}</p>
          </div>
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.06] p-4">
            <p className="text-sm text-white/70">Past</p>
            <p className="text-2xl font-bold text-white/80">{ordersByStage.pastOrders.length}</p>
          </div>
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.06] p-4">
            <p className="text-sm text-white/70">Total Processed</p>
            <p className="text-2xl font-bold text-emerald-300">{ordersByStage.processedCount}</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`operator-active-order-skeleton-${index}`}
                className="dashboard-surface-soft rounded-xl p-4"
              >
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-64" />
                  <div className="flex gap-3 pt-2">
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-9 w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : noOrdersAvailable ? (
          <div className="dashboard-surface-soft rounded-xl p-6 text-center text-white/70">
            <p className="text-lg font-semibold">No Orders Found</p>
            <p className="text-sm mt-1">There are no orders assigned to you for the current period.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.05] p-4">
              <label className="mb-2 block text-sm font-semibold text-white/80">Search Your Orders</label>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5">
                <Icon icon="mdi:magnify" className="text-xl text-white/60" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by Tracking ID, Name, Location..."
                  className="w-full bg-transparent text-base text-white outline-none placeholder:text-white/45"
                />
              </div>
            </div>

            {totalVisibleOrders === 0 ? (
              <div className="dashboard-surface-soft rounded-xl p-6 text-center text-white/70">
                <p className="text-lg font-semibold">No Matches</p>
                <p className="mt-1 text-sm">
                  No orders matched your search for <span className="font-medium text-white">&quot;{searchQuery}&quot;</span>.
                </p>
              </div>
            ) : (
              showOnlyActive ? (
                <div className="space-y-3">
                  {filteredOrders.activeOrders.map((order) =>
                    renderOrderCard(order, "Active", "border-[#e4e67a]/45 bg-[#e4e67a]/10 text-[#f1f4aa]"),
                  )}
                </div>
              ) : (
                <div className="space-y-6">
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
      <ConfirmationModal
        isOpen={Boolean(permissionModal && permissionModalCopy)}
        title={permissionModalCopy?.title ?? "Allow permission"}
        description={permissionModalCopy?.description}
        confirmLabel={permissionModalCopy?.confirmLabel ?? "Continue"}
        cancelLabel="Not now"
        confirmVariant="primary"
        isLoading={permissionActionLoading}
        disableClose={permissionActionLoading}
        onClose={() => setPermissionModal(null)}
        onConfirm={() => {
          void handlePermissionModalConfirm();
        }}
      >
        {permissionModal ? (
          <div className="space-y-3 text-sm text-white/75">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
              {permissionModal.kind === "location"
                ? "GPS sorting helps the operator dashboard prioritize the nearest active stop."
                : "Camera access is required to capture pickup, drop, and office-drop proof directly from the operator dashboard."}
            </div>
            {permissionModalCopy?.helperText ? (
              <p className="text-xs text-amber-100/85">{permissionModalCopy.helperText}</p>
            ) : null}
          </div>
        ) : null}
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={Boolean(incidentTarget)}
        title={incidentTarget ? getIncidentReportCopy(incidentTarget.type).title : "Report Incident"}
        description={
          incidentTarget ? getIncidentReportCopy(incidentTarget.type).description : "Submit an incident report for this order."
        }
        confirmLabel={incidentTarget ? getIncidentReportCopy(incidentTarget.type).confirmLabel : "Submit Report"}
        confirmVariant="warning"
        isLoading={Boolean(reportingOrderId && incidentTarget?.orderId === reportingOrderId)}
        onClose={() => {
          if (reportingOrderId) return;
          setIncidentTarget(null);
        }}
        onConfirm={submitIncidentReport}
      >
        {incidentTarget ? (
          <div className="space-y-3 text-sm text-white/75">
            <p>{getIncidentReportCopy(incidentTarget.type).guidance}</p>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/65">
              This report will be attached to the order so admin can review the incident immediately.
            </div>
          </div>
        ) : null}
      </ConfirmationModal>

      {proofCaptureTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          onClick={closeProofCamera}
          role="presentation"
        >
          <div
            className="dashboard-surface w-full max-w-sm rounded-2xl p-4"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Capture order proof"
          >
            <h3 className="text-sm font-semibold text-[#E4E67A]">
              {proofCaptureTarget.proofType === "pickup" ? "Capture Pickup Proof" : proofCaptureTarget.proofType === "office_drop" ? "Capture Office Drop Proof" : "Capture Drop Proof"}
            </h3>
            <p className="mt-1 text-xs text-white/65">Rear camera only. File upload is disabled.</p>

            <div className="dashboard-subsurface mt-3 overflow-hidden rounded-xl">
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
