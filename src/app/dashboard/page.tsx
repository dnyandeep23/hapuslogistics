"use client"
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Image, { StaticImageData } from 'next/image'
import { useAppSelector } from '@/lib/redux/hooks'
import myPackageImg from "@/assets/images/mypackage.png";
import addPackageImg from "@/assets/images/addpackage.png";
import trackPackageImg from "@/assets/images/trackpackage.png";
import { useRouter } from 'next/navigation'
import RecentOrders from '@/components/RecentOrders';
import OrderTrackingWidget from '@/components/OrderTrackingWidget';
import { resetPackageState } from '@/lib/redux/packageSlice';
import { AppDispatch } from '@/lib/redux/store';
import { useDispatch, useSelector } from 'react-redux';
import { Icon } from "@iconify/react";
import { fetchUser } from '@/lib/redux/userSlice';
import { useDropzone } from 'react-dropzone';
import CustomDateRangePicker from '@/components/CustomDateRangePicker';
import { useResponsiveMode } from '@/hooks/useResponsiveMode';
import OperatorActiveOrderCard, {
  type OperatorActiveOrder,
  type OperatorOrderBuckets,
} from '@/components/dashboard/OperatorActiveOrderCard';
import {
  DEFAULT_PACKAGE_CATEGORIES,
  buildCategoryFareMap,
  getActivePackageCategories,
  normalizePackageCategories,
} from '@/lib/packageCatalog';
import { formatIndiaPhoneInput, normalizeIndiaPhone } from '@/lib/phone';

type AdminLocation = {
  _id: string;
  name: string;
  address?: string;
  city: string;
  state: string;
  zip?: string;
};

type RouteConfigForm = {
  pickupLocationId: string;
  dropLocationId: string;
  pickupTime: string;
  dropTime: string;
  materialFares: Record<string, number>;
  dateOverrides: {
    date: string;
    fares: Record<string, number>;
    minimized: boolean;
  }[];
  minimized: boolean;
};

type BusPricing = {
  pickupLocation: unknown;
  dropLocation: unknown;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  pickupTime?: string;
  dropTime?: string;
  fares?: Record<string, number>;
  dateOverrides?: Array<{ date?: string; fares?: Record<string, number> }>;
};

type AdminBus = {
  _id: string;
  busName: string;
  busNumber: string;
  busImages: string[];
  capacity: number;
  autoRenewCapacity?: boolean;
  availability?: { date?: string }[];
  pricing?: BusPricing[];
};

type AdminBusFieldErrors = Record<string, string>;
type InlineLocationFieldErrors = Record<string, string>;

type InlineLocationTarget = {
  routeIndex: number;
  field: "pickup" | "drop";
} | null;

const defaultMaterialFareMap: Record<string, number> = buildCategoryFareMap(
  getActivePackageCategories(DEFAULT_PACKAGE_CATEGORIES),
);

const BUS_NUMBER_PATTERN = /^[A-Z]{2}-\d{2}-[A-Z]{2}-\d{4}$/;
const EMPTY_OPERATOR_ORDER_BUCKETS: OperatorOrderBuckets = {
  activeOrders: [],
  upcomingOrders: [],
  pastOrders: [],
  processedCount: 0,
};

const makeDefaultRouteConfig = (fareMap: Record<string, number> = defaultMaterialFareMap): RouteConfigForm => ({
  pickupLocationId: "",
  dropLocationId: "",
  pickupTime: "08:00",
  dropTime: "18:00",
  materialFares: { ...fareMap },
  dateOverrides: [],
  minimized: false,
});

const makeEmptyInlineLocationForm = () => ({
  name: "",
  address: "",
  city: "",
  state: "",
  zip: "",
});

const getDefaultPricingRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};

const formatBusNumberInput = (value: string) => {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  const parts = [
    cleaned.slice(0, 2),
    cleaned.slice(2, 4),
    cleaned.slice(4, 6),
    cleaned.slice(6, 10),
  ].filter(Boolean);
  return parts.join("-");
};

export default function DashboardPage() {
  const { isMobile, isTablet } = useResponsiveMode();
  const { user } = useAppSelector((state) => state.user)
  const packageState = useSelector((state: any) => state.package);
  const hasUncompletedPackage = Boolean(
    packageState?.formData?.cart?.length > 0 ||
    packageState?.formData?.pickupLocationId ||
    packageState?.formData?.dropLocationId ||
    packageState?.currentPackage?.packageType
  );
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const [bannerSlides, setBannerSlides] = useState<string[]>([]);
  const [busName, setBusName] = useState("");
  const [busNumber, setBusNumber] = useState("");
  const [capacity, setCapacity] = useState(40);
  const [autoRenewCapacity, setAutoRenewCapacity] = useState(false);
  const [materialFareMap, setMaterialFareMap] = useState<Record<string, number>>(defaultMaterialFareMap);
  const defaultPricingRange = useMemo(() => getDefaultPricingRange(), []);
  const [availabilityStartDate, setAvailabilityStartDate] = useState(defaultPricingRange.start);
  const [availabilityEndDate, setAvailabilityEndDate] = useState(defaultPricingRange.end);
  const [routeConfigs, setRouteConfigs] = useState<RouteConfigForm[]>([makeDefaultRouteConfig(defaultMaterialFareMap)]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [showInlineLocationCreator, setShowInlineLocationCreator] = useState<InlineLocationTarget>(null);
  const [inlineLocationForm, setInlineLocationForm] = useState(makeEmptyInlineLocationForm());
  const [inlineLocationFieldErrors, setInlineLocationFieldErrors] = useState<InlineLocationFieldErrors>({});
  const [inlineLocationError, setInlineLocationError] = useState("");
  const [inlineLocationMessage, setInlineLocationMessage] = useState("");
  const [savingInlineLocation, setSavingInlineLocation] = useState(false);
  const [busImages, setBusImages] = useState<File[]>([]);
  const [savingBus, setSavingBus] = useState(false);
  const [adminBusMessage, setAdminBusMessage] = useState("");
  const [adminBusError, setAdminBusError] = useState("");
  const [adminBusFieldErrors, setAdminBusFieldErrors] = useState<AdminBusFieldErrors>({});
  const [adminBuses, setAdminBuses] = useState<AdminBus[]>([]);
  const [loadingAdminBuses, setLoadingAdminBuses] = useState(false);

  const [editingBusId, setEditingBusId] = useState<string | null>(null);
  const [operatorOrdersByStage, setOperatorOrdersByStage] = useState<OperatorOrderBuckets>(EMPTY_OPERATOR_ORDER_BUCKETS);
  const [operatorOrderLoading, setOperatorOrderLoading] = useState(false);
  const [operatorOrderError, setOperatorOrderError] = useState("");
  const [requiredAdminPhoneDraft, setRequiredAdminPhoneDraft] = useState("");
  const [requiredAdminPhoneError, setRequiredAdminPhoneError] = useState("");
  const [requiredAdminPhoneMessage, setRequiredAdminPhoneMessage] = useState("");
  const [savingRequiredAdminPhone, setSavingRequiredAdminPhone] = useState(false);

  const mapActiveBannersToCarousel = useCallback((slides: unknown[]) => {
    const normalized = [...slides]
      .map((slide, index) => {
        if (typeof slide === "string") {
          const imageUrl = slide.trim();
          return imageUrl ? { imageUrl, sequence: index } : null;
        }

        if (!slide || typeof slide !== "object") return null;
        const entry = slide as { imageUrl?: unknown; sequence?: unknown };
        const imageUrl = String(entry.imageUrl ?? "").trim();
        if (!imageUrl) return null;
        return {
          imageUrl,
          sequence: Number.isFinite(Number(entry.sequence)) ? Number(entry.sequence) : index,
        };
      })
      .filter((slide): slide is { imageUrl: string; sequence: number } => Boolean(slide))
      .sort((a, b) => a.sequence - b.sequence)
      .map((slide) => slide.imageUrl);

    setBannerSlides(normalized);
  }, []);
  const busImagePreviews = useMemo(
    () =>
      busImages.map((file, index) => ({
        id: `${file.name}-${file.lastModified}-${index}`,
        file,
        preview: URL.createObjectURL(file),
      })),
    [busImages],
  );

  useEffect(() => {
    return () => {
      busImagePreviews.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, [busImagePreviews]);

  useEffect(() => {
    setRequiredAdminPhoneDraft(formatIndiaPhoneInput(user?.phone ?? ""));
    setRequiredAdminPhoneError("");
    setRequiredAdminPhoneMessage("");
  }, [user?.phone]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [] },
    multiple: false,
    onDrop: (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;
      setBusImages([acceptedFiles[0]]);
    },
  });

  const isAdminRole = user?.role === "admin";
  const editingBus = useMemo(
    () => adminBuses.find((bus) => bus._id === editingBusId) ?? null,
    [adminBuses, editingBusId],
  );

  const parseLocationId = (value: unknown) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object" && "_id" in (value as Record<string, unknown>)) {
      return String((value as { _id?: unknown })._id ?? "");
    }
    if (typeof value === "object" && "toString" in (value as Record<string, unknown>)) {
      return String((value as { toString: () => string }).toString());
    }
    return "";
  };

  const parseFares = useCallback((fares: unknown) => {
    const fallback = { ...materialFareMap };
    if (!fares || typeof fares !== "object") return fallback;

    const source = fares instanceof Map
      ? Object.fromEntries(fares.entries())
      : (fares as Record<string, unknown>);

    const normalized: Record<string, number> = {};
    for (const categoryName of Object.keys(fallback)) {
      const parsed = Number(source[categoryName]);
      normalized[categoryName] = Number.isFinite(parsed) && parsed >= 0
        ? parsed
        : fallback[categoryName];
    }
    return normalized;
  }, [materialFareMap]);

  const loadMaterialFareMap = useCallback(async () => {
    if (!isAdminRole) return;
    try {
      const response = await fetch("/api/package-catalog", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) return;

      const categories = getActivePackageCategories(
        normalizePackageCategories(payload?.categories, DEFAULT_PACKAGE_CATEGORIES),
      );
      if (categories.length > 0) {
        setMaterialFareMap(buildCategoryFareMap(categories));
      }
    } catch {
      setMaterialFareMap(defaultMaterialFareMap);
    }
  }, [isAdminRole]);

  useEffect(() => {
    setRouteConfigs((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) {
        return [makeDefaultRouteConfig(materialFareMap)];
      }
      return prev.map((route) => ({
        ...route,
        materialFares: parseFares(route.materialFares),
        dateOverrides: Array.isArray(route.dateOverrides)
          ? route.dateOverrides.map((override) => ({
            ...override,
            fares: parseFares(override.fares),
          }))
          : [],
      }));
    });
  }, [materialFareMap, parseFares]);

  const resetAdminBusForm = () => {
    setEditingBusId(null);
    setBusName("");
    setBusNumber("");
    setCapacity(40);
    setAutoRenewCapacity(false);
    const defaultRange = getDefaultPricingRange();
    setAvailabilityStartDate(defaultRange.start);
    setAvailabilityEndDate(defaultRange.end);
    setRouteConfigs([makeDefaultRouteConfig(materialFareMap)]);
    setBusImages([]);
    setAdminBusFieldErrors({});
    setShowInlineLocationCreator(null);
    setInlineLocationForm(makeEmptyInlineLocationForm());
    setInlineLocationFieldErrors({});
    setInlineLocationError("");
    setInlineLocationMessage("");
  };

  const handleAddPackageClick = () => {
    dispatch(resetPackageState());
    router.push('/package');
  };

  const handleOrdersClick = () => {
    router.push('/dashboard/orders');
  };

  const handleTrackOrderClick = () => {
    const tracker = document.getElementById("dashboard-order-tracker");
    if (tracker) {
      tracker.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    router.push("/dashboard/orders");
  };

  const handleSupportClick = () => {
    router.push('/dashboard/support');
  };

  const handleUsersClick = () => {
    if (user?.role === "admin") {
      router.push("/dashboard/operator");
      return;
    }
    router.push('/dashboard/users');
  };

  const handleSaveRequiredAdminPhone = async () => {
    const normalizedPhone = normalizeIndiaPhone(requiredAdminPhoneDraft);
    setRequiredAdminPhoneError("");
    setRequiredAdminPhoneMessage("");

    if (normalizedPhone === "") {
      setRequiredAdminPhoneError("Contact number is required before adding your first bus.");
      return;
    }

    if (normalizedPhone === null) {
      setRequiredAdminPhoneError("Enter a valid Indian mobile number.");
      return;
    }

    try {
      setSavingRequiredAdminPhone(true);
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setRequiredAdminPhoneError(payload?.message || "Failed to save contact number.");
        return;
      }

      setRequiredAdminPhoneMessage(payload?.message || "Contact number saved successfully.");
      await dispatch(fetchUser()).unwrap();
    } catch (error: unknown) {
      setRequiredAdminPhoneError(
        error instanceof Error ? error.message : "Failed to save contact number.",
      );
    } finally {
      setSavingRequiredAdminPhone(false);
    }
  };

  const loadLocations = useCallback(async () => {
    if (!isAdminRole) return;
    try {
      setLoadingLocations(true);
      const response = await fetch("/api/locations", { method: "GET" });
      const payload = await response.json();
      if (!response.ok) {
        setAdminBusError(payload?.message || "Failed to load locations.");
        return;
      }
      setLocations(Array.isArray(payload) ? payload : []);
    } catch (error: unknown) {
      setAdminBusError(error instanceof Error ? error.message : "Failed to load locations.");
    } finally {
      setLoadingLocations(false);
    }
  }, [isAdminRole]);

  const loadAdminBuses = useCallback(async () => {
    if (!isAdminRole) return;
    try {
      setLoadingAdminBuses(true);
      const response = await fetch("/api/admin/buses", { method: "GET" });
      const payload = await response.json();
      if (!response.ok) {
        setAdminBusError(payload?.message || "Failed to load buses.");
        return;
      }
      setAdminBuses(Array.isArray(payload?.buses) ? payload.buses : []);
    } catch (error: unknown) {
      setAdminBusError(error instanceof Error ? error.message : "Failed to load buses.");
    } finally {
      setLoadingAdminBuses(false);
    }
  }, [isAdminRole]);

  useEffect(() => {
    if (!isAdminRole) return;
    loadMaterialFareMap();
    loadLocations();
    loadAdminBuses();
  }, [isAdminRole, loadAdminBuses, loadLocations, loadMaterialFareMap]);

  const loadOperatorActiveOrder = useCallback(async () => {
    if (user?.role !== "operator") return;
    try {
      setOperatorOrderLoading(true);
      setOperatorOrderError("");
      const response = await fetch("/api/operator/active-order", { method: "GET", cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setOperatorOrderError(payload?.message || "Failed to load active orders.");
        setOperatorOrdersByStage(EMPTY_OPERATOR_ORDER_BUCKETS);
        return;
      }
      const activeOrders = Array.isArray(payload?.orders)
        ? payload.orders
        : payload?.order
          ? [payload.order]
          : [];
      const upcomingOrders = Array.isArray(payload?.upcomingOrders) ? payload.upcomingOrders : [];
      const pastOrders = Array.isArray(payload?.pastOrders) ? payload.pastOrders : [];
      const processedCountRaw = Number(payload?.processedCount);
      const processedCount = Number.isFinite(processedCountRaw) ? processedCountRaw : pastOrders.length;

      setOperatorOrdersByStage({
        activeOrders: activeOrders as OperatorActiveOrder[],
        upcomingOrders: upcomingOrders as OperatorActiveOrder[],
        pastOrders: pastOrders as OperatorActiveOrder[],
        processedCount,
      });
    } catch (error: unknown) {
      setOperatorOrderError(error instanceof Error ? error.message : "Failed to load active orders.");
      setOperatorOrdersByStage(EMPTY_OPERATOR_ORDER_BUCKETS);
    } finally {
      setOperatorOrderLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "operator") return;
    loadOperatorActiveOrder();
  }, [loadOperatorActiveOrder, user?.role]);

  useEffect(() => {
    if (!user || user.role === "operator") return;

    const loadDashboardBanners = async () => {
      try {
        const response = await fetch("/api/dashboard/banners", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          setBannerSlides([]);
          return;
        }
        const activeSlides = Array.isArray(payload?.activeSlides) ? payload.activeSlides : [];
        const fallbackSlides = Array.isArray(payload?.slides) ? payload.slides : [];
        const sourceSlides = activeSlides.length > 0 ? activeSlides : fallbackSlides;
        mapActiveBannersToCarousel(sourceSlides as unknown[]);
      } catch {
        setBannerSlides([]);
      }
    };

    loadDashboardBanners();
  }, [mapActiveBannersToCarousel, user, user?.role]);

  const updateRouteConfig = (index: number, updater: (current: RouteConfigForm) => RouteConfigForm) => {
    setRouteConfigs((prev) =>
      prev.map((route, routeIndex) => (routeIndex === index ? updater(route) : route)),
    );
  };

  const addRouteConfig = () => {
    setRouteConfigs((prev) => [...prev, makeDefaultRouteConfig(materialFareMap)]);
  };

  const removeRouteConfig = (index: number) => {
    setRouteConfigs((prev) => (prev.length === 1 ? prev : prev.filter((_, routeIndex) => routeIndex !== index)));
  };

  const toggleRouteMinimize = (index: number) => {
    updateRouteConfig(index, (current) => ({ ...current, minimized: !current.minimized }));
  };

  const addRouteDateOverride = (routeIndex: number) => {
    updateRouteConfig(routeIndex, (current) => ({
      ...current,
      dateOverrides: [
        ...current.dateOverrides,
        {
          date: availabilityStartDate,
          fares: { ...current.materialFares },
          minimized: false,
        },
      ],
    }));
  };

  const removeRouteDateOverride = (routeIndex: number, overrideIndex: number) => {
    updateRouteConfig(routeIndex, (current) => ({
      ...current,
      dateOverrides: current.dateOverrides.filter((_, index) => index !== overrideIndex),
    }));
  };

  const toggleRouteDateOverrideMinimize = (routeIndex: number, overrideIndex: number) => {
    updateRouteConfig(routeIndex, (current) => ({
      ...current,
      dateOverrides: current.dateOverrides.map((override, index) =>
        index === overrideIndex ? { ...override, minimized: !override.minimized } : override,
      ),
    }));
  };

  const openInlineLocationCreator = (routeIndex: number, field: "pickup" | "drop") => {
    setShowInlineLocationCreator({ routeIndex, field });
    setInlineLocationForm(makeEmptyInlineLocationForm());
    setInlineLocationFieldErrors({});
    setInlineLocationError("");
    setInlineLocationMessage("");
  };

  const closeInlineLocationCreator = () => {
    setShowInlineLocationCreator(null);
    setInlineLocationForm(makeEmptyInlineLocationForm());
    setInlineLocationFieldErrors({});
    setInlineLocationError("");
    setInlineLocationMessage("");
  };

  const handleInlineLocationCreate = async () => {
    if (!showInlineLocationCreator) return;

    setInlineLocationError("");
    setInlineLocationMessage("");
    const nextErrors: InlineLocationFieldErrors = {};

    if (!inlineLocationForm.name.trim()) nextErrors.name = "Location name is required.";
    if (!inlineLocationForm.address.trim()) nextErrors.address = "Address is required.";
    if (!inlineLocationForm.city.trim()) nextErrors.city = "City is required.";
    if (!inlineLocationForm.state.trim()) nextErrors.state = "State is required.";
    if (!inlineLocationForm.zip.trim()) nextErrors.zip = "ZIP code is required.";

    if (Object.keys(nextErrors).length > 0) {
      setInlineLocationFieldErrors(nextErrors);
      setInlineLocationError("Please complete all required location fields.");
      return;
    }

    setInlineLocationFieldErrors({});

    try {
      setSavingInlineLocation(true);
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inlineLocationForm),
      });
      const payload = await response.json();

      if (!response.ok) {
        setInlineLocationError(payload?.message || "Failed to add location.");
        return;
      }

      const createdLocationId = String(payload?.location?._id ?? "");
      if (createdLocationId) {
        const { routeIndex, field } = showInlineLocationCreator;
        updateRouteConfig(routeIndex, (current) => {
          if (field === "pickup") {
            return {
              ...current,
              pickupLocationId: createdLocationId,
              dropLocationId:
                current.dropLocationId === createdLocationId ? "" : current.dropLocationId,
            };
          }
          return {
            ...current,
            dropLocationId: createdLocationId,
          };
        });
      }

      await loadLocations();
      setInlineLocationMessage(payload?.message || "Location added successfully.");
      setAdminBusMessage("Location added and selected.");
      setInlineLocationForm(makeEmptyInlineLocationForm());
      setInlineLocationFieldErrors({});
    } catch (error: unknown) {
      setInlineLocationError(error instanceof Error ? error.message : "Failed to add location.");
    } finally {
      setSavingInlineLocation(false);
    }
  };

  const services = (() => {
    if (user?.role === "operator") {
      return [
        {
          title: "Company",
          description: "Open your roster, company details, and assigned team context.",
          actionLabel: "Open company",
          iconKey: "solar:buildings-2-bold-duotone",
          icon: addPackageImg,
          width: 115,
          onclick: handleUsersClick,
        },
        {
          title: "Support Desk",
          description: "Reach the admin line, employee directory, and latest support alerts.",
          actionLabel: "Open support",
          iconKey: "solar:headphones-round-sound-bold-duotone",
          icon: trackPackageImg,
          width: 135,
          onclick: handleSupportClick,
        },
      ];
    }

    if (user?.role === "admin") {
      return [
        {
          title: "Order Analytics",
          description: "Review order flow, status movement, and operational pressure points.",
          actionLabel: "View orders",
          iconKey: "solar:chart-square-bold-duotone",
          icon: myPackageImg,
          width: 135,
          onclick: handleOrdersClick,
        },
        {
          title: "Operator Analytics",
          description: "See operator activity, staffing coverage, and company support structure.",
          actionLabel: "View operators",
          iconKey: "solar:users-group-two-rounded-bold-duotone",
          icon: addPackageImg,
          width: 130,
          onclick: handleUsersClick,
        },
        {
          title: "Route Analytics",
          description: "Jump into routes, pricing, and pickup or drop planning lanes.",
          actionLabel: "View routes",
          iconKey: "solar:route-bold-duotone",
          icon: trackPackageImg,
          width: 135,
          onclick: () => router.push("/dashboard/locations"),
        },
      ];
    }

    const baseUserServices = [
      {
        title: "My Packages",
        description: "View current package history, statuses, and delivery progress in one place.",
        actionLabel: "View orders",
        iconKey: "solar:box-bold-duotone",
        icon: myPackageImg,
        width: 135,
        onclick: handleOrdersClick,
      }
    ];

    if (hasUncompletedPackage) {
      baseUserServices.push({
        title: "New Package",
        description: "Discard your previous draft and start a fresh shipment.",
        actionLabel: "Start fresh",
        iconKey: "solar:refresh-circle-bold-duotone",
        icon: addPackageImg,
        width: 115,
        onclick: handleAddPackageClick,
      });
    } else {
      baseUserServices.push({
        title: "Add Package",
        description: "Create a new shipment quickly and pick up where you left off anytime.",
        actionLabel: "Start booking",
        iconKey: "solar:add-circle-bold-duotone",
        icon: addPackageImg,
        width: 115,
        onclick: handleAddPackageClick,
      });
    }

    baseUserServices.push({
      title: "Track & Shipments",
      description: "Track live movement and check delivery updates without leaving the dashboard.",
      actionLabel: "Track now",
      iconKey: "solar:delivery-bold-duotone",
      icon: trackPackageImg,
      width: 135,
      onclick: handleTrackOrderClick,
    });

    return baseUserServices;
  })();

  const isAdminLocked = user?.role === "admin" && user?.hasRegisteredBus === false;
  const isAdminMissingContactNumber = user?.role === "admin" && !normalizeIndiaPhone(user?.phone);
  const isOperatorRole = user?.role === "operator";
  const isPublicUserRole = user?.role === "user";
  const dashboardTitle = user?.name
    ? `Hey ${user.name.split(" ")[0]} 👋`
    : "Hey there 👋";
  const dashboardSubtitle = isAdminRole
    ? "Manage fleet, routes, operators, and support from a stronger visual cockpit."
    : isOperatorRole
      ? "Stay on top of active orders, jump into your company details, and keep the admin contact close."
      : "Book packages, track movement, and reach support without digging through text-heavy screens.";
  const dashboardRoleLabel = isAdminRole ? "Admin dashboard" : isOperatorRole ? "Operator dashboard" : "Customer dashboard";
  const dashboardRoleIcon = isAdminRole
    ? "solar:crown-bold-duotone"
    : isOperatorRole
      ? "solar:shield-user-bold-duotone"
      : "solar:home-smile-bold-duotone";
  // const customerGreeting = user?.name
  //   ? `Hey ${user.name.split(" ")[0]} 👋`
  //   : "Hey there 👋";
  const supportSpotlight = isAdminRole
    ? {
      eyebrow: "Support command",
      title: "Operator and customer support stays one tap away.",
      description: "Use the support tab for company contacts, employee visibility, and live alerts while running admin operations.",
      buttonLabel: "Open support hub",
    }
    : isOperatorRole
      ? {
        eyebrow: "Admin contact",
        title: user?.adminContactPhone || "Support line available in your workspace",
        description: user?.adminContactPhone
          ? "Keep your admin contact number nearby for assignment, approval, or company issues."
          : "Open the support tab to find your admin line, employee directory, and recent support updates.",
        buttonLabel: "Open support hub",
      }
      : {
        eyebrow: "Need help fast?",
        title: "Support, tracking, and order help are built into your dashboard.",
        description: "The support tab now brings company contacts and employee information together in a clearer, icon-led layout.",
        buttonLabel: "Open support hub",
      };
  const locationNameById = useMemo(
    () =>
      new Map(
        locations.map((location) => [location._id, `${location.name} (${location.city})`]),
      ),
    [locations],
  );

  const handleAdminBusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminBusError("");
    setAdminBusMessage("");
    const fieldErrors: AdminBusFieldErrors = {};

    if (!busName) fieldErrors.busName = "Bus name is required.";
    if (!busNumber) {
      fieldErrors.busNumber = "Bus number is required.";
    } else if (!BUS_NUMBER_PATTERN.test(busNumber)) {
      fieldErrors.busNumber = "Format must be like MH-02-BL-2254.";
    }
    if (capacity <= 0) fieldErrors.capacity = "Capacity must be greater than 0.";
    if (!availabilityStartDate || !availabilityEndDate) {
      fieldErrors.availabilityRange = "Availability date range is required.";
    } else if (availabilityEndDate < availabilityStartDate) {
      fieldErrors.availabilityRange = "End date cannot be before start date.";
    }

    const existingImageCount = Array.isArray(editingBus?.busImages) ? editingBus.busImages.length : 0;
    if (busImages.length === 0 && existingImageCount === 0) {
      fieldErrors.busImages = "Upload one bus image.";
    }
    if (busImages.length > 1) {
      fieldErrors.busImages = "Only one bus image is allowed.";
    }

    for (let i = 0; i < routeConfigs.length; i += 1) {
      const route = routeConfigs[i];
      const routePrefix = `route.${i}`;
      if (!route.pickupLocationId) fieldErrors[`${routePrefix}.pickupLocationId`] = "Pickup location is required.";
      if (!route.dropLocationId) fieldErrors[`${routePrefix}.dropLocationId`] = "Drop location is required.";
      if (!route.pickupTime) fieldErrors[`${routePrefix}.pickupTime`] = "Pickup time is required.";
      if (!route.dropTime) fieldErrors[`${routePrefix}.dropTime`] = "Drop time is required.";
      if (route.pickupLocationId && route.dropLocationId && route.pickupLocationId === route.dropLocationId) {
        fieldErrors[`${routePrefix}.dropLocationId`] = "Pickup and drop must be different.";
      }
      if (Object.values(route.materialFares).every((fare) => Number(fare) <= 0)) {
        fieldErrors[`${routePrefix}.materialFares`] = "Add at least one valid price.";
      }

      for (let overrideIndex = 0; overrideIndex < route.dateOverrides.length; overrideIndex += 1) {
        const override = route.dateOverrides[overrideIndex];
        const overridePrefix = `${routePrefix}.override.${overrideIndex}`;
        if (!override.date) {
          fieldErrors[`${overridePrefix}.date`] = "Override date is required.";
        } else if (
          availabilityStartDate &&
          availabilityEndDate &&
          (override.date < availabilityStartDate || override.date > availabilityEndDate)
        ) {
          fieldErrors[`${overridePrefix}.date`] = "Override date must be inside selected date range.";
        }

        if (Object.values(override.fares).every((fare) => Number(fare) <= 0)) {
          fieldErrors[`${overridePrefix}.fares`] = "Set at least one valid override price.";
        }
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      setAdminBusFieldErrors(fieldErrors);
      setAdminBusError("Please fix the highlighted fields.");
      return;
    }
    setAdminBusFieldErrors({});

    try {
      setSavingBus(true);
      const formData = new FormData();
      formData.append("busName", busName);
      formData.append("busNumber", busNumber);
      formData.append("capacity", String(capacity));
      formData.append("autoRenewCapacity", String(autoRenewCapacity));
      formData.append("availabilityStartDate", availabilityStartDate);
      formData.append("availabilityEndDate", availabilityEndDate);
      formData.append(
        "routesConfig",
        JSON.stringify(
          routeConfigs.map((route) => ({
            pickupLocationId: route.pickupLocationId,
            dropLocationId: route.dropLocationId,
            pickupTime: route.pickupTime,
            dropTime: route.dropTime,
            materialFares: route.materialFares,
            dateOverrides: route.dateOverrides.map((override) => ({
              date: override.date,
              fares: override.fares,
            })),
          })),
        ),
      );
      if (busImages[0]) {
        formData.append("busImages", busImages[0]);
      }

      const response = await fetch(editingBusId ? `/api/admin/buses/${editingBusId}` : "/api/admin/buses", {
        method: editingBusId ? "PATCH" : "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        setAdminBusError(payload?.message || "Failed to add bus.");
        return;
      }

      setAdminBusMessage(payload?.message || (editingBusId ? "Bus updated successfully." : "Bus added successfully."));
      await dispatch(fetchUser()).unwrap();
      await loadAdminBuses();
      resetAdminBusForm();
    } catch (error: unknown) {
      setAdminBusError(error instanceof Error ? error.message : "Failed to add bus.");
    } finally {
      setSavingBus(false);
    }
  };


  if (isAdminLocked) {
    return (
      <div className={`${isMobile ? "p-1.5 pb-24" : isTablet ? "p-4 pb-28" : "p-2 sm:p-6 lg:p-8 pb-20"} text-center`}>
        <div className="mx-auto max-w-4xl">
          <div className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(31,40,29,0.98),rgba(21,29,23,0.96),rgba(15,21,16,0.98))] p-6 text-left shadow-[0_28px_70px_rgba(0,0,0,0.24)] sm:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#d3ba69]/30 bg-[#d3ba69]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f6de9c]">
                  <Icon icon="solar:bus-line-duotone" className="text-base" />
                  First-time admin setup
                </div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#F4F8BF]">
                  Add your contact number first, then launch your first bus.
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/72 sm:text-base">
                  Your phone number is used as the primary admin contact for operations and support. Once that is saved, you can add your first bus and unlock the full dashboard.
                </p>
              </div>

              <div className="grid gap-3 rounded-[1.6rem] border border-white/10 bg-white/5 p-4 xl:min-w-[320px]">
                <div className="rounded-[1.25rem] border border-white/10 bg-black/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isAdminMissingContactNumber ? "bg-amber-500/12 text-amber-200" : "bg-emerald-500/12 text-emerald-200"}`}>
                      <Icon icon={isAdminMissingContactNumber ? "solar:phone-calling-rounded-linear" : "solar:check-circle-bold-duotone"} className="text-[1.35rem]" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">Step 1</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {isAdminMissingContactNumber ? "Add contact number" : "Contact number saved"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.25rem] border border-white/10 bg-black/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d5e400]/12 text-[#E4E67A]">
                      <Icon icon="solar:bus-line-duotone" className="text-[1.35rem]" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">Step 2</p>
                      <p className="mt-1 text-sm font-semibold text-white">Add first bus</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_auto]">
              <div className="rounded-[1.75rem] border border-white/10 bg-black/10 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#d5e400]/12 text-[#E4E67A]">
                    <Icon icon="solar:phone-calling-rounded-bold-duotone" className="text-[1.5rem]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">Admin contact number</p>
                    <p className="mt-1 text-sm text-white/62">
                      Add the number your team and users should reach first.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="tel"
                    value={requiredAdminPhoneDraft}
                    onChange={(event) => {
                      setRequiredAdminPhoneDraft(formatIndiaPhoneInput(event.target.value));
                      if (requiredAdminPhoneError) setRequiredAdminPhoneError("");
                      if (requiredAdminPhoneMessage) setRequiredAdminPhoneMessage("");
                    }}
                    placeholder="+91 9876543210"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#D5E400]/45"
                  />
                  <button
                    type="button"
                    onClick={handleSaveRequiredAdminPhone}
                    disabled={savingRequiredAdminPhone || !isAdminMissingContactNumber}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#D5E400]/30 bg-[#D5E400]/10 px-5 py-3 text-sm font-semibold text-[#F4F8BF] transition hover:bg-[#D5E400]/16 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon icon={savingRequiredAdminPhone ? "line-md:loading-loop" : "solar:check-circle-bold-duotone"} className="text-base" />
                    {savingRequiredAdminPhone ? "Saving..." : isAdminMissingContactNumber ? "Save Contact" : "Saved"}
                  </button>
                </div>

                {requiredAdminPhoneError ? (
                  <p className="mt-3 text-sm text-rose-300">{requiredAdminPhoneError}</p>
                ) : null}
                {requiredAdminPhoneMessage ? (
                  <p className="mt-3 text-sm text-emerald-300">{requiredAdminPhoneMessage}</p>
                ) : null}
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/addbus")}
                  disabled={isAdminMissingContactNumber}
                  className="inline-flex items-center gap-2 rounded-full border border-[#D5E400] px-8 py-3 font-semibold text-[#D5E400] transition-all duration-300 hover:bg-[#D5E400] hover:text-black hover:shadow-2xl hover:shadow-[#D5E400]/60 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/40 disabled:hover:bg-transparent disabled:hover:text-white/40 disabled:hover:shadow-none"
                >
                  <Icon icon="solar:bus-line-duotone" className="text-lg" />
                  Add Your First Bus
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAdminRole) {
    return (
      <div className={isMobile ? 'p-1.5 pb-24' : isTablet ? 'p-3 pb-28' : 'p-2 sm:p-6 lg:p-8 pb-20'}>
        <DashboardHero
          eyebrow={dashboardRoleLabel}
          title={dashboardTitle}
          description={dashboardSubtitle}
          icon={dashboardRoleIcon}
        />

        <div className="mt-8 space-y-8">
          <SupportSpotlightCard
            eyebrow={supportSpotlight.eyebrow}
            title={supportSpotlight.title}
            description={supportSpotlight.description}
            buttonLabel={supportSpotlight.buttonLabel}
            onClick={handleSupportClick}
          />
          <ServicesSection services={services} />
        </div>
      </div>
    )
  }

  return (
    <div className={isMobile ? 'p-1.5 pb-24' : isTablet ? 'p-3 pb-28' : 'p-2 sm:p-4 lg:p-8 pb-20'}>
      <DashboardHero
        eyebrow={dashboardRoleLabel}
        title={`${dashboardTitle}`}
        description={dashboardSubtitle}
        icon={dashboardRoleIcon}
      />

      {isOperatorRole ? (
        <div className="mt-8 space-y-8">

          <OperatorActiveOrderCard
            ordersByStage={operatorOrdersByStage}
            loading={operatorOrderLoading}
            error={operatorOrderError}
            onRefresh={loadOperatorActiveOrder}
            showOnlyActive
          />
          <ServicesSection services={services} />
          <SupportSpotlightCard
            eyebrow={supportSpotlight.eyebrow}
            title={supportSpotlight.title}
            description={supportSpotlight.description}
            buttonLabel={supportSpotlight.buttonLabel}
            onClick={handleSupportClick}
          />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {bannerSlides.length > 0 ? <BannerCarousel slides={bannerSlides} /> : null}

          {isPublicUserRole ? (
            <div className="flex flex-col gap-8">
              <div id="dashboard-order-tracker" className="min-w-0">
                <OrderTrackingWidget mode="dashboard" />
              </div>
              <div className="">
                <SupportSpotlightCard
                  eyebrow={supportSpotlight.eyebrow}
                  title={supportSpotlight.title}
                  description={supportSpotlight.description}
                  buttonLabel={supportSpotlight.buttonLabel}
                  onClick={handleSupportClick}
                />
              </div>
            </div>
          ) : null}

          {isPublicUserRole && hasUncompletedPackage ? (
            <section className="mb-8 w-full overflow-hidden rounded-[2rem] border border-[#D5E400]/40 bg-[linear-gradient(135deg,rgba(213,228,0,0.15),rgba(176,191,18,0.05))] p-6 shadow-[0_20px_60px_rgba(213,228,0,0.12)] backdrop-blur-xl transition-all hover:bg-[linear-gradient(135deg,rgba(213,228,0,0.2),rgba(176,191,18,0.08))] sm:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D5E400]/20 text-[#D5E400] shadow-[inset_0_0_12px_rgba(213,228,0,0.3)]">
                    <Icon icon="solar:clock-circle-bold-duotone" className="animate-pulse text-2xl" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D5E400]">URGENT DRAFT</p>
                       <span className="relative flex h-2 w-2">
                         <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D5E400] opacity-75" />
                         <span className="relative inline-flex h-2 w-2 rounded-full bg-[#D5E400]" />
                       </span>
                    </div>
                    <h2 className="mt-1 text-lg font-bold text-white sm:text-xl">Unfinished Package Found</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-white/70">You left a booking mid-way. Resume exactly where you left off before the session expires.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/package")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-transparent bg-[#D5E400] px-8 py-3.5 text-sm font-bold text-black shadow-[0_8px_24px_rgba(213,228,0,0.35)] transition hover:scale-105 hover:bg-[#e4f51e] active:scale-95 sm:w-auto"
                >
                  Complete Package Now
                  <Icon icon="solar:arrow-right-linear" className="text-lg" />
                </button>
              </div>
            </section>
          ) : null}

          <ServicesSection services={services} />

          <div className="flex flex-col">
            <div className="min-w-0">
              <RecentOrders />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface Service {
  title: string;
  description: string;
  actionLabel: string;
  iconKey: string;
  icon: StaticImageData;
  width: number;
  onclick?: () => void;
}

function DashboardHero({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
}) {
  const { isMobile, isTablet } = useResponsiveMode();

  return (
    <section className={`relative border-b border-white/5 ${isMobile ? "mb-5 pb-4" : isTablet ? "mb-6 pb-5" : "mb-8 pb-6"}`}>
      <div className={`max-w-4xl ${isTablet ? "grid gap-4 md:grid-cols-[1fr_auto] md:items-end" : ""}`}>
        <div>
        <div className={`inline-flex items-center gap-2 rounded-full border border-[#D5E400]/20 bg-[#D5E400]/5 ${isMobile ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-xs"} font-bold uppercase tracking-widest text-[#D5E400]`}>
          <Icon icon={icon} className="text-lg" />
          {eyebrow}
        </div>
        <h1 className={`max-w-4xl font-extrabold tracking-tight text-white ${isMobile ? "mt-4 text-[1.9rem] leading-[1.05]" : isTablet ? "mt-5 text-[2.5rem] leading-[1.02]" : "mt-6 text-4xl sm:text-5xl"}`}>
          {title}
        </h1>
        <p className={`max-w-2xl text-white/50 ${isMobile ? "mt-3 text-sm leading-6" : "mt-4 text-base leading-relaxed"}`}>
          {description}
        </p>
        </div>
        {isTablet ? (
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Device mode</p>
            <p className="mt-1 text-sm font-semibold text-[#F6FF6A]">Tablet workspace</p>
            <p className="mt-1 text-xs text-white/60">Balanced density with split cards and faster scanning.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SupportSpotlightCard({
  eyebrow,
  title,
  description,
  buttonLabel,
  onClick,
}: {
  eyebrow: string;
  title: string;
  description: string;
  buttonLabel: string;
  onClick?: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/5 bg-[#141A14] p-6 shadow-sm transition-all hover:bg-[#1A221A]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-[#D5E400]">
            <Icon icon="solar:headphones-round-sound-bold-duotone" className="text-2xl" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D5E400]/70">{eyebrow}</p>
            <h2 className="mt-1 text-lg font-bold text-white">{title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/50">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95"
        >
          <Icon icon="solar:arrow-right-up-linear" className="text-base text-[#D5E400]" />
          {buttonLabel}
        </button>
      </div>
    </section>
  );
}

function BannerCarousel({ slides }: { slides: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeActiveIndex = slides.length > 0 ? activeIndex % slides.length : 0;

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [slides.length]);

  const goToSlide = (index: number) => setActiveIndex(index);
  const goPrev = () => setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  const goNext = () => setActiveIndex((prev) => (prev + 1) % slides.length);

  return (
    <div className='dashboard-surface mt-4 relative overflow-hidden rounded-2xl'>
      <div
        className='flex transition-transform duration-500 ease-out'
        style={{ transform: `translateX(-${safeActiveIndex * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <div key={`slide-${index}`} className='relative min-w-full h-48 sm:h-64 lg:h-96'>
            <Image src={slide} alt={`banner slide ${index + 1}`} fill className='object-cover' priority={index === 0} />
            <div className='absolute inset-0 bg-linear-to-r from-black/40 via-transparent to-black/20' />
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type='button'
            aria-label='Previous banner'
            onClick={goPrev}
            className='absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/40 p-2 text-white hover:bg-black/60'
          >
            <Icon icon='material-symbols:chevron-left-rounded' className='text-2xl' />
          </button>
          <button
            type='button'
            aria-label='Next banner'
            onClick={goNext}
            className='absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/40 p-2 text-white hover:bg-black/60'
          >
            <Icon icon='material-symbols:chevron-right-rounded' className='text-2xl' />
          </button>

          <div className='absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2'>
            {slides.map((_, index) => (
              <button
                key={`dot-${index}`}
                type='button'
                aria-label={`Go to banner ${index + 1}`}
                onClick={() => goToSlide(index)}
                className={`h-2.5 w-2.5 rounded-full transition ${index === safeActiveIndex ? 'bg-[#E4E67A]' : 'bg-white/50'
                  }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ServicesSection({ services }: { services: Service[] }) {
  const { isMobile, isTablet } = useResponsiveMode();
  const visibleServices = isMobile ? services.slice(0, 2) : services;

  return (
    <div className={`${isMobile ? "space-y-4" : "space-y-6"}`}>
      <div className={`mb-8 flex flex-col gap-2 ${isMobile ? "" : "sm:flex-row sm:items-end sm:justify-between"}`}>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-1">Quick Actions</h2>
          <p className="text-sm text-white/50">
            {isMobile
              ? "Essential actions for smaller screens."
              : isTablet
                ? "Balanced shortcuts for touch-first dashboards."
                : "Common operations available in your workspace."}
          </p>
        </div>
        {isMobile ? (
          <p className="text-xs text-white/42">Open more actions from the bottom navigation.</p>
        ) : null}
      </div>

      <div className={`grid ${isMobile ? "grid-cols-1 gap-3" : isTablet ? "grid-cols-2 gap-4" : "grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3"}`}>
        {visibleServices.map((service, index) => (
          <button
            key={index}
            type="button"
            onClick={service.onclick}
            className={`group relative flex flex-col items-start justify-between border border-white/5 bg-[#141A14] text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:bg-[#1A221A] active:scale-[0.98] ${
              isMobile ? "rounded-[1.5rem] p-4" : isTablet ? "rounded-[1.75rem] p-5" : "rounded-[2rem] p-6"
            }`}
          >
            <div className={`mb-6 flex items-center justify-center rounded-full bg-white/5 text-[#D5E400] transition-colors group-hover:bg-[#D5E400]/10 ${
              isMobile ? "h-11 w-11" : "h-14 w-14"
            }`}>
              <Icon icon={service.iconKey} className={isMobile ? "text-xl" : "text-2xl"} />
            </div>

            <div className={isMobile ? "mb-3" : "mb-4"}>
              <p className={`${isMobile ? "text-base" : "text-lg"} mb-1 font-bold text-white`}>{service.title}</p>
              <p className={`text-white/50 leading-relaxed ${isMobile ? "text-xs line-clamp-2" : isTablet ? "text-sm line-clamp-2" : "text-sm line-clamp-2"}`}>
                {isMobile ? service.description.split(".")[0] : service.description}
              </p>
            </div>

            <div className={`mt-auto flex items-center gap-2 font-semibold text-white/70 transition-colors group-hover:text-[#D5E400] ${isMobile ? "text-xs" : "text-sm"}`}>
              <span>{service.actionLabel}</span>
              <Icon icon="solar:arrow-right-linear" className="text-base opacity-0 -ml-2 transition-all group-hover:opacity-100 group-hover:ml-0" />
            </div>
          </button>
        ))}
      </div>
      {isMobile && services.length > visibleServices.length ? (
        <div className="rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">
          More role actions are available from the dashboard sections and bottom navigation.
        </div>
      ) : null}
    </div>
  );
}
