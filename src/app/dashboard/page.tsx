"use client"
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Image, { StaticImageData } from 'next/image'
import { useAppSelector } from '@/lib/redux/hooks'
import myPackageImg from "@/assets/images/mypackage.png";
import addPackageImg from "@/assets/images/addpackage.png";
import trackPackageImg from "@/assets/images/trackpackage.png";
import { useRouter } from 'next/navigation'
import ContinueOrderPrompt from '@/components/ContinueOrderPrompt'
import RecentOrders from '@/components/RecentOrders';
import OrderTrackingWidget from '@/components/OrderTrackingWidget';
import { resetPackageState } from '@/lib/redux/packageSlice';
import { AppDispatch } from '@/lib/redux/store';
import { useDispatch } from 'react-redux';
import { Icon } from "@iconify/react";
import { fetchUser } from '@/lib/redux/userSlice';
import { useDropzone } from 'react-dropzone';
import CustomDateRangePicker from '@/components/CustomDateRangePicker';
import CustomDatePicker from '@/components/CustomDatePicker';
import CustomTimePicker from '@/components/CustomTimePicker';
import OperatorActiveOrderCard, { type OperatorActiveOrder } from '@/components/dashboard/OperatorActiveOrderCard';

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

const defaultMaterialFareMap: Record<string, number> = {
  Wooden: 70,
  "Plastic / Fibre": 60,
  Iron: 80,
  Electronics: 95,
  "Mango Box": 55,
  Other: 65,
};

const BUS_NUMBER_PATTERN = /^[A-Z]{2}-\d{2}-[A-Z]{2}-\d{4}$/;

const makeDefaultRouteConfig = (): RouteConfigForm => ({
  pickupLocationId: "",
  dropLocationId: "",
  pickupTime: "08:00",
  dropTime: "18:00",
  materialFares: { ...defaultMaterialFareMap },
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
  const { user } = useAppSelector((state) => state.user)
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const [bannerSlides, setBannerSlides] = useState<string[]>([]);
  const [busName, setBusName] = useState("");
  const [busNumber, setBusNumber] = useState("");
  const [capacity, setCapacity] = useState(40);
  const [autoRenewCapacity, setAutoRenewCapacity] = useState(false);
  const defaultPricingRange = useMemo(() => getDefaultPricingRange(), []);
  const [availabilityStartDate, setAvailabilityStartDate] = useState(defaultPricingRange.start);
  const [availabilityEndDate, setAvailabilityEndDate] = useState(defaultPricingRange.end);
  const [routeConfigs, setRouteConfigs] = useState<RouteConfigForm[]>([makeDefaultRouteConfig()]);
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
  const [showAdminBusForm, setShowAdminBusForm] = useState(false);
  const [editingBusId, setEditingBusId] = useState<string | null>(null);
  const [operatorActiveOrder, setOperatorActiveOrder] = useState<OperatorActiveOrder | null>(null);
  const [operatorOrderLoading, setOperatorOrderLoading] = useState(false);
  const [operatorOrderError, setOperatorOrderError] = useState("");

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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [] },
    multiple: false,
    onDrop: (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;
      setBusImages([acceptedFiles[0]]);
    },
  });

  const isAdminRole = user?.role === "admin" || user?.isSuperAdmin;
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

  const parseFares = (fares: unknown) => {
    const fallback = { ...defaultMaterialFareMap };
    if (!fares || typeof fares !== "object") return fallback;

    const entries = fares instanceof Map
      ? Array.from(fares.entries())
      : Object.entries(fares as Record<string, unknown>);

    return entries.reduce<Record<string, number>>((acc, [key, value]) => {
      const parsed = Number(value);
      acc[key] = Number.isNaN(parsed) ? 0 : parsed;
      return acc;
    }, fallback);
  };

  const resetAdminBusForm = () => {
    setEditingBusId(null);
    setBusName("");
    setBusNumber("");
    setCapacity(40);
    setAutoRenewCapacity(false);
    const defaultRange = getDefaultPricingRange();
    setAvailabilityStartDate(defaultRange.start);
    setAvailabilityEndDate(defaultRange.end);
    setRouteConfigs([makeDefaultRouteConfig()]);
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
    router.push('/dashboard/users');
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
    loadLocations();
    loadAdminBuses();
  }, [isAdminRole, loadAdminBuses, loadLocations]);

  const loadOperatorActiveOrder = useCallback(async () => {
    if (user?.role !== "operator") return;
    try {
      setOperatorOrderLoading(true);
      setOperatorOrderError("");
      const response = await fetch("/api/operator/active-order", { method: "GET", cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setOperatorOrderError(payload?.message || "Failed to load active order.");
        setOperatorActiveOrder(null);
        return;
      }
      setOperatorActiveOrder(payload?.order ?? null);
    } catch (error: unknown) {
      setOperatorOrderError(error instanceof Error ? error.message : "Failed to load active order.");
      setOperatorActiveOrder(null);
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
    setRouteConfigs((prev) => [...prev, makeDefaultRouteConfig()]);
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
          icon: addPackageImg,
          width: 115,
          onclick: handleUsersClick,
        },
        {
          title: "Support Desk",
          icon: trackPackageImg,
          width: 135,
          onclick: handleSupportClick,
        },
      ];
    }

    if (user?.isSuperAdmin) {
      return [
        {
          title: "Order Analytics",
          icon: myPackageImg,
          width: 135,
          onclick: handleOrdersClick,
        },
        {
          title: "User Analytics",
          icon: addPackageImg,
          width: 120,
          onclick: handleUsersClick,
        },
        {
          title: "Platform Trends",
          icon: trackPackageImg,
          width: 140,
          onclick: handleOrdersClick,
        },
      ];
    }

    if (user?.role === "admin") {
      return [
        {
          title: "Order Analytics",
          icon: myPackageImg,
          width: 135,
          onclick: handleOrdersClick,
        },
        {
          title: "Operator Analytics",
          icon: addPackageImg,
          width: 130,
          onclick: handleUsersClick,
        },
        {
          title: "Route Analytics",
          icon: trackPackageImg,
          width: 135,
          onclick: handleOrdersClick,
        },
      ];
    }

    return [
      {
        title: "My Packages",
        icon: myPackageImg,
        width: 135,
        onclick: handleOrdersClick,
      },
      {
        title: "Add Package",
        icon: addPackageImg,
        width: 115,
        onclick: handleAddPackageClick,
      },
      {
        title: "Track & Shipments",
        icon: trackPackageImg,
        width: 135,
        onclick: handleTrackOrderClick,
      },
    ];
  })();

  const isAdminLocked = user?.role === "admin" && !user?.isSuperAdmin && user?.hasRegisteredBus === false;
  const isOperatorRole = user?.role === "operator";
  const isPublicUserRole = user?.role === "user";
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
      if (!isAdminLocked) setShowAdminBusForm(false);
    } catch (error: unknown) {
      setAdminBusError(error instanceof Error ? error.message : "Failed to add bus.");
    } finally {
      setSavingBus(false);
    }
  };

  const renderAdminBusForm = ({ locked = false }: { locked?: boolean } = {}) => (
    <div className="rounded-2xl border border-[#4e573f] bg-[#1f251c] p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#E4E67A]">
            {editingBusId ? "Edit Bus" : locked ? "Add First Bus" : "Add New Bus"}
          </h1>
          <p className="text-white/75 text-sm mt-2">
            At least one bus image is required.
          </p>
          <p className="text-white/55 text-xs mt-1">
            Contact person details are auto-filled from the assigned operator period.
          </p>
        </div>
        {!locked && showAdminBusForm && (
          <button
            type="button"
            onClick={() => {
              resetAdminBusForm();
              setShowAdminBusForm(false);
            }}
            className="rounded-lg border border-white/30 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
          >
            Cancel
          </button>
        )}
      </div>

      <form onSubmit={handleAdminBusSubmit} className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm text-white/80">
          Bus Name
          <input
            value={busName}
            onChange={(event) => setBusName(event.target.value)}
            placeholder="Enter bus name"
            className={`mt-2 w-full bg-black px-4 pt-4 pb-2 rounded-lg text-base border-b-2 transition-all ${adminBusFieldErrors.busName ? "border-red-500" : "border-white/60 focus:border-white"} focus:outline-none`}
          />
          {adminBusFieldErrors.busName && <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors.busName}</p>}
        </label>

        <label className="text-sm text-white/80">
          Bus Number
          <input
            value={busNumber}
            onChange={(event) => setBusNumber(formatBusNumberInput(event.target.value))}
            placeholder="MH-02-BL-2254"
            className={`mt-2 w-full bg-black px-4 pt-4 pb-2 rounded-lg text-base border-b-2 transition-all uppercase ${adminBusFieldErrors.busNumber ? "border-red-500" : "border-white/60 focus:border-white"} focus:outline-none`}
          />
          <p className="mt-1 text-xs text-white/50">Format: AA-00-AA-0000</p>
          {adminBusFieldErrors.busNumber && <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors.busNumber}</p>}
        </label>

        <label className="text-sm text-white/80">
          Bus Capacity (KG)
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(event) => setCapacity(Number(event.target.value) || 1)}
            placeholder="Capacity"
            className={`mt-2 w-full bg-black px-4 pt-4 pb-2 rounded-lg text-base border-b-2 transition-all ${adminBusFieldErrors.capacity ? "border-red-500" : "border-white/60 focus:border-white"} focus:outline-none`}
          />
          {adminBusFieldErrors.capacity && <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors.capacity}</p>}
        </label>

        <label className="text-sm text-white/80 md:col-span-2">
          Availability Date Range
          <div className="mt-2">
            <CustomDateRangePicker
              startDate={availabilityStartDate}
              endDate={availabilityEndDate}
              onChange={({ startDate, endDate }) => {
                setAvailabilityStartDate(startDate);
                setAvailabilityEndDate(endDate);
              }}
              error={adminBusFieldErrors.availabilityRange}
              minDate={new Date().toISOString().slice(0, 10)}
            />
          </div>
          {adminBusFieldErrors.availabilityRange && <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors.availabilityRange}</p>}
        </label>

        <div className="md:col-span-2 rounded-lg border border-white/20 bg-black/20 px-4 py-3">
          <label className="inline-flex items-center gap-3 text-sm text-white/90 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRenewCapacity}
              onChange={(event) => setAutoRenewCapacity(event.target.checked)}
              className="h-4 w-4 accent-[#CDD645]"
            />
            Auto renew selected date capacity
          </label>
          <p className="mt-1 text-xs text-white/55">
            When enabled, this bus keeps the selected default capacity for new scheduling cycles.
          </p>
        </div>

        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-white/80">Pickup and Drop Routes (multiple allowed)</p>
            <button
              type="button"
              onClick={addRouteConfig}
              className="rounded-md border border-[#D5E400]/60 px-3 py-1.5 text-xs text-[#E4E67A] hover:bg-[#D5E400]/10"
            >
              + Add Route
            </button>
          </div>

          <div className="space-y-4">
            {routeConfigs.map((routeConfig, routeIndex) => (
              <div key={`route-${routeIndex}`} className="rounded-xl border border-white/20 bg-black/30 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#E4E67A]">Route {routeIndex + 1}</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleRouteMinimize(routeIndex)}
                      className="rounded-md border border-white/30 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/10"
                    >
                      {routeConfig.minimized ? "Expand" : "Minimize"}
                    </button>
                    {routeConfigs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRouteConfig(routeIndex)}
                        className="text-xs text-red-300 hover:text-red-200"
                      >
                        Remove Route
                      </button>
                    )}
                  </div>
                </div>

                {routeConfig.minimized && (
                  <p className="text-xs text-white/65">
                    {locationNameById.get(routeConfig.pickupLocationId) || "Pickup"} to{" "}
                    {locationNameById.get(routeConfig.dropLocationId) || "Drop"} |{" "}
                    {routeConfig.pickupTime || "--:--"} - {routeConfig.dropTime || "--:--"}
                  </p>
                )}

                {!routeConfig.minimized && (
                  <>
                    <div className="mb-3 rounded-lg border border-white/15 bg-black/25 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] text-white/70">
                          Pickup/drop not found? Add it here or use Sidebar {">"} Pickup/Drop.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openInlineLocationCreator(routeIndex, "pickup")}
                            className="rounded-md border border-[#D5E400]/60 px-2.5 py-1 text-[11px] text-[#E4E67A] hover:bg-[#D5E400]/10"
                          >
                            + Add Pickup
                          </button>
                          <button
                            type="button"
                            onClick={() => openInlineLocationCreator(routeIndex, "drop")}
                            className="rounded-md border border-[#D5E400]/60 px-2.5 py-1 text-[11px] text-[#E4E67A] hover:bg-[#D5E400]/10"
                          >
                            + Add Drop
                          </button>
                        </div>
                      </div>

                      {showInlineLocationCreator?.routeIndex === routeIndex && (
                        <div className="mt-3 rounded-lg border border-white/15 bg-black/30 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-[#E4E67A]">
                              Add {showInlineLocationCreator.field === "pickup" ? "Pickup" : "Drop"} Location
                            </p>
                            <button
                              type="button"
                              onClick={closeInlineLocationCreator}
                              className="rounded-md border border-white/30 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/10"
                            >
                              Close
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <label className="text-[11px] text-white/80">
                              Location Name
                              <input
                                value={inlineLocationForm.name}
                                onChange={(event) =>
                                  setInlineLocationForm((prev) => ({ ...prev, name: event.target.value }))
                                }
                                className={`mt-1 w-full rounded-md bg-black px-2 py-1.5 text-xs text-white outline-none border ${inlineLocationFieldErrors.name ? "border-red-500" : "border-white/20"}`}
                                placeholder="e.g. Dadar TT"
                              />
                              {inlineLocationFieldErrors.name && (
                                <p className="mt-1 text-[10px] text-red-400">{inlineLocationFieldErrors.name}</p>
                              )}
                            </label>

                            <label className="text-[11px] text-white/80">
                              City
                              <input
                                value={inlineLocationForm.city}
                                onChange={(event) =>
                                  setInlineLocationForm((prev) => ({ ...prev, city: event.target.value }))
                                }
                                className={`mt-1 w-full rounded-md bg-black px-2 py-1.5 text-xs text-white outline-none border ${inlineLocationFieldErrors.city ? "border-red-500" : "border-white/20"}`}
                                placeholder="City"
                              />
                              {inlineLocationFieldErrors.city && (
                                <p className="mt-1 text-[10px] text-red-400">{inlineLocationFieldErrors.city}</p>
                              )}
                            </label>

                            <label className="text-[11px] text-white/80">
                              State
                              <input
                                value={inlineLocationForm.state}
                                onChange={(event) =>
                                  setInlineLocationForm((prev) => ({ ...prev, state: event.target.value }))
                                }
                                className={`mt-1 w-full rounded-md bg-black px-2 py-1.5 text-xs text-white outline-none border ${inlineLocationFieldErrors.state ? "border-red-500" : "border-white/20"}`}
                                placeholder="State"
                              />
                              {inlineLocationFieldErrors.state && (
                                <p className="mt-1 text-[10px] text-red-400">{inlineLocationFieldErrors.state}</p>
                              )}
                            </label>

                            <label className="text-[11px] text-white/80">
                              ZIP
                              <input
                                value={inlineLocationForm.zip}
                                onChange={(event) =>
                                  setInlineLocationForm((prev) => ({ ...prev, zip: event.target.value }))
                                }
                                className={`mt-1 w-full rounded-md bg-black px-2 py-1.5 text-xs text-white outline-none border ${inlineLocationFieldErrors.zip ? "border-red-500" : "border-white/20"}`}
                                placeholder="ZIP Code"
                              />
                              {inlineLocationFieldErrors.zip && (
                                <p className="mt-1 text-[10px] text-red-400">{inlineLocationFieldErrors.zip}</p>
                              )}
                            </label>

                            <label className="text-[11px] text-white/80 md:col-span-2">
                              Address
                              <input
                                value={inlineLocationForm.address}
                                onChange={(event) =>
                                  setInlineLocationForm((prev) => ({ ...prev, address: event.target.value }))
                                }
                                className={`mt-1 w-full rounded-md bg-black px-2 py-1.5 text-xs text-white outline-none border ${inlineLocationFieldErrors.address ? "border-red-500" : "border-white/20"}`}
                                placeholder="Street / landmark"
                              />
                              {inlineLocationFieldErrors.address && (
                                <p className="mt-1 text-[10px] text-red-400">{inlineLocationFieldErrors.address}</p>
                              )}
                            </label>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[11px] text-white/65">
                              Duplicate locations are blocked automatically.
                            </div>
                            <button
                              type="button"
                              onClick={handleInlineLocationCreate}
                              disabled={savingInlineLocation}
                              className="rounded-md border border-[#D5E400]/70 px-3 py-1.5 text-xs font-semibold text-[#E4E67A] hover:bg-[#D5E400]/10 disabled:opacity-60"
                            >
                              {savingInlineLocation ? "Saving..." : "Save Location"}
                            </button>
                          </div>

                          {inlineLocationError && (
                            <p className="mt-2 text-[11px] text-red-300">{inlineLocationError}</p>
                          )}
                          {inlineLocationMessage && (
                            <p className="mt-2 text-[11px] text-green-300">{inlineLocationMessage}</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="text-xs text-white/80">
                        Pickup Location
                        <select
                          value={routeConfig.pickupLocationId}
                          onChange={(event) => {
                            const nextPickup = event.target.value;
                            updateRouteConfig(routeIndex, (current) => ({
                              ...current,
                              pickupLocationId: nextPickup,
                              dropLocationId:
                                current.dropLocationId === nextPickup ? "" : current.dropLocationId,
                            }));
                          }}
                          className={`mt-2 block w-full rounded-lg bg-black px-3 py-2 text-white/90 outline-none border ${adminBusFieldErrors[`route.${routeIndex}.pickupLocationId`] ? "border-red-500" : "border-white/20"}`}
                        >
                          <option value="" className="text-black">Select pickup location</option>
                          {locations.map((location) => (
                            <option key={location._id} value={location._id} className="text-black">
                              {location.name} ({location.city})
                            </option>
                          ))}
                        </select>
                        {adminBusFieldErrors[`route.${routeIndex}.pickupLocationId`] && (
                          <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors[`route.${routeIndex}.pickupLocationId`]}</p>
                        )}
                      </label>

                      <label className="text-xs text-white/80">
                        Drop Location
                        <select
                          value={routeConfig.dropLocationId}
                          onChange={(event) =>
                            updateRouteConfig(routeIndex, (current) => ({
                              ...current,
                              dropLocationId: event.target.value,
                            }))
                          }
                          className={`mt-2 block w-full rounded-lg bg-black px-3 py-2 text-white/90 outline-none border ${adminBusFieldErrors[`route.${routeIndex}.dropLocationId`] ? "border-red-500" : "border-white/20"}`}
                        >
                          <option value="" className="text-black">Select drop location</option>
                          {locations
                            .filter((location) => location._id !== routeConfig.pickupLocationId)
                            .map((location) => (
                              <option key={location._id} value={location._id} className="text-black">
                                {location.name} ({location.city})
                              </option>
                            ))}
                        </select>
                        {adminBusFieldErrors[`route.${routeIndex}.dropLocationId`] && (
                          <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors[`route.${routeIndex}.dropLocationId`]}</p>
                        )}
                      </label>

                      <label className="text-xs text-white/80">
                        Pickup Time
                        <div className="mt-2">
                          <CustomTimePicker
                            value={routeConfig.pickupTime}
                            onChange={(nextTime) =>
                              updateRouteConfig(routeIndex, (current) => ({
                                ...current,
                                pickupTime: nextTime,
                              }))
                            }
                            error={adminBusFieldErrors[`route.${routeIndex}.pickupTime`]}
                          />
                        </div>
                        {adminBusFieldErrors[`route.${routeIndex}.pickupTime`] && (
                          <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors[`route.${routeIndex}.pickupTime`]}</p>
                        )}
                      </label>

                      <label className="text-xs text-white/80">
                        Drop Time
                        <div className="mt-2">
                          <CustomTimePicker
                            value={routeConfig.dropTime}
                            onChange={(nextTime) =>
                              updateRouteConfig(routeIndex, (current) => ({
                                ...current,
                                dropTime: nextTime,
                              }))
                            }
                            error={adminBusFieldErrors[`route.${routeIndex}.dropTime`]}
                          />
                        </div>
                        {adminBusFieldErrors[`route.${routeIndex}.dropTime`] && (
                          <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors[`route.${routeIndex}.dropTime`]}</p>
                        )}
                      </label>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs text-white/80 mb-2">Price (INR) by Material Type</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {Object.entries(routeConfig.materialFares).map(([material, fare]) => (
                          <label key={`${material}-${routeIndex}`} className="text-[11px] text-white/70">
                            {material} Price
                            <input
                              type="number"
                              min={0}
                              value={fare}
                              onChange={(event) =>
                                updateRouteConfig(routeIndex, (current) => ({
                                  ...current,
                                  materialFares: {
                                    ...current.materialFares,
                                    [material]: Number(event.target.value) || 0,
                                  },
                                }))
                              }
                              className="mt-1 w-full bg-black rounded-md border border-white/20 px-2 py-1.5 text-xs text-white outline-none"
                            />
                          </label>
                        ))}
                      </div>
                      {adminBusFieldErrors[`route.${routeIndex}.materialFares`] && (
                        <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors[`route.${routeIndex}.materialFares`]}</p>
                      )}
                    </div>

                    <div className="mt-4 rounded-lg border border-white/15 bg-black/25 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-white/80">Specific Date Price Overrides</p>
                        <button
                          type="button"
                          onClick={() => addRouteDateOverride(routeIndex)}
                          className="rounded-md border border-[#D5E400]/60 px-2.5 py-1 text-[11px] text-[#E4E67A] hover:bg-[#D5E400]/10"
                        >
                          + Add Specific Date
                        </button>
                      </div>
                      {routeConfig.dateOverrides.length === 0 ? (
                        <p className="mt-2 text-[11px] text-white/55">
                          No overrides yet. Default range pricing will apply.
                        </p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {routeConfig.dateOverrides.map((override, overrideIndex) => (
                            <div key={`route-${routeIndex}-override-${overrideIndex}`} className="rounded-md border border-white/15 bg-black/40 p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-[11px] text-[#E4E67A]">Override {overrideIndex + 1}</p>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleRouteDateOverrideMinimize(routeIndex, overrideIndex)}
                                    className="rounded-md border border-white/30 px-2 py-0.5 text-[10px] text-white/80 hover:bg-white/10"
                                  >
                                    {override.minimized ? "Expand" : "Minimize"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeRouteDateOverride(routeIndex, overrideIndex)}
                                    className="text-[11px] text-red-300 hover:text-red-200"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>

                              {override.minimized ? (
                                <p className="text-[11px] text-white/65">
                                  {override.date || "--"} | override fares configured
                                </p>
                              ) : (
                                <>
                                  <label className="text-[11px] text-white/80">
                                    Specific Date
                                    <div className="mt-1">
                                      <CustomDatePicker
                                        value={override.date}
                                        minDate={availabilityStartDate}
                                        maxDate={availabilityEndDate}
                                        restrictToAvailableDates={false}
                                        syncWithCartDate={false}
                                        onChange={(nextValue) =>
                                          updateRouteConfig(routeIndex, (current) => ({
                                            ...current,
                                            dateOverrides: current.dateOverrides.map((item, index) =>
                                              index === overrideIndex
                                                ? { ...item, date: nextValue }
                                                : item,
                                            ),
                                          }))
                                        }
                                        error={adminBusFieldErrors[`route.${routeIndex}.override.${overrideIndex}.date`]}
                                      />
                                    </div>
                                  </label>
                                  {adminBusFieldErrors[`route.${routeIndex}.override.${overrideIndex}.date`] && (
                                    <p className="mt-1 text-[11px] text-red-400">{adminBusFieldErrors[`route.${routeIndex}.override.${overrideIndex}.date`]}</p>
                                  )}

                                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                                    {Object.entries(override.fares).map(([material, fare]) => (
                                      <label key={`${material}-${routeIndex}-${overrideIndex}`} className="text-[11px] text-white/70">
                                        {material} Price
                                        <input
                                          type="number"
                                          min={0}
                                          value={fare}
                                          onChange={(event) =>
                                            updateRouteConfig(routeIndex, (current) => ({
                                              ...current,
                                              dateOverrides: current.dateOverrides.map((item, index) =>
                                                index === overrideIndex
                                                  ? {
                                                      ...item,
                                                      fares: {
                                                        ...item.fares,
                                                        [material]: Number(event.target.value) || 0,
                                                      },
                                                    }
                                                  : item,
                                              ),
                                            }))
                                          }
                                          className="mt-1 w-full rounded-md border border-white/20 bg-black px-2 py-1.5 text-xs text-white outline-none"
                                        />
                                      </label>
                                    ))}
                                  </div>
                                  {adminBusFieldErrors[`route.${routeIndex}.override.${overrideIndex}.fares`] && (
                                    <p className="mt-1 text-[11px] text-red-400">{adminBusFieldErrors[`route.${routeIndex}.override.${overrideIndex}.fares`]}</p>
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <p className="text-sm text-white/80 mb-2">Upload Bus Image (single)</p>
          <div className="flex flex-wrap gap-3">
            <div
              {...getRootProps()}
              className={`h-24 w-24 rounded-lg border-2 border-dashed cursor-pointer flex items-center justify-center transition-colors ${isDragActive ? "border-[#CDD645] bg-[#1e241b]/60" : "border-white/40 bg-black/20 hover:border-[#CDD645]/70"}`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center text-white/70 text-[11px]">
                <Icon icon="solar:camera-add-linear" className="text-lg mb-1" />
                <span>{isDragActive ? "Drop" : "Add"}</span>
              </div>
            </div>

            {busImagePreviews.map((image, index) => (
              <div key={image.id} className="relative h-24 w-24 rounded-lg overflow-hidden border border-white/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.preview}
                  alt={image.file.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setBusImages((prev) => prev.filter((_, fileIndex) => fileIndex !== index))}
                  className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-red-300 hover:text-red-200"
                  aria-label={`Remove ${image.file.name}`}
                >
                  <Icon icon="solar:trash-bin-trash-linear" className="text-sm" />
                </button>
              </div>
            ))}
          </div>
          {editingBus && editingBus.busImages?.length > 0 && busImages.length === 0 && (
            <div className="mt-3">
              <p className="text-xs text-white/60 mb-2">Existing image (kept on update):</p>
              <div className="flex flex-wrap gap-3">
                <div className="h-24 w-24 rounded-lg overflow-hidden border border-white/15">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={editingBus.busImages[0]} alt="Existing bus image" className="h-full w-full object-cover" />
                </div>
              </div>
            </div>
          )}
          {busImages.length > 0 && (
            <p className="mt-2 text-xs text-white/60">
              1 new image selected.
            </p>
          )}
          {adminBusFieldErrors.busImages && <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors.busImages}</p>}
        </div>

        <div className="md:col-span-2 flex items-center justify-between gap-3">
          <p className="text-xs text-white/70">
            {loadingLocations
              ? "Loading locations..."
              : busImages.length > 0
                ? "1 image selected"
                : "No new image selected"}
          </p>
          <button
            type="submit"
            disabled={savingBus || loadingLocations}
            className="px-6 py-2 rounded-full border border-[#D5E400] text-[#D5E400] font-semibold transition-all duration-300 hover:shadow-2xl hover:shadow-[#D5E400]/60 hover:bg-[#D5E400] hover:text-black disabled:opacity-50"
          >
            {savingBus ? (editingBusId ? "Updating..." : "Saving...") : editingBusId ? "Update Bus" : "Add Bus"}
          </button>
        </div>
      </form>

      {adminBusError && (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {adminBusError}
        </div>
      )}
      {adminBusMessage && (
        <div className="mt-4 rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
          {adminBusMessage}
        </div>
      )}
    </div>
  );

  if (isAdminLocked) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 pb-20">
        <div className="rounded-2xl border border-[#d3ba69]/45 bg-[#d3ba69]/10 p-4 text-sm text-[#f6de9c] mb-6">
          Add your first bus to unlock Orders, Operators and Support routes.
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard/addbus")}
          className="px-6 py-2 rounded-full border border-[#D5E400] text-[#D5E400] font-semibold transition-all duration-300 hover:shadow-2xl hover:shadow-[#D5E400]/60 hover:bg-[#D5E400] hover:text-black"
        >
          Go To Add Bus
        </button>
      </div>
    );
  }


  return (
    <div className='p-4 sm:p-6 lg:p-8 pb-20'>
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-2">Hey,</h1>
        <p className="text-3xl font-bold text-[#E4E67A]">{user?.name} 👋</p>
      </div>

      {isOperatorRole ? (
        <div className="space-y-8">
          <OperatorActiveOrderCard
            order={operatorActiveOrder}
            loading={operatorOrderLoading}
            error={operatorOrderError}
            onRefresh={loadOperatorActiveOrder}
          />
          <ServicesSection services={services} />
        </div>
      ) : (
        <div>
          {bannerSlides.length > 0 && <BannerCarousel slides={bannerSlides} />}
          {isPublicUserRole && (
            <div id="dashboard-order-tracker" className='mt-12'>
              <OrderTrackingWidget mode="dashboard" />
            </div>
          )}
          <div>
            <ServicesSection services={services} />
          </div>
          <div className='mt-12'>
            <ContinueOrderPrompt />
          </div>
          <div className='mt-12'>
            <RecentOrders />
          </div>
        </div>
      )}
    </div>
  )
}

interface Service {
  title: string;
  icon: StaticImageData;
  width: number;
  onclick?: () => void;
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
    <div className='mt-4 relative overflow-hidden rounded-2xl border border-[#4e573f] bg-[#1f251c]'>
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
  return (
    <div className="my-12">
      {/* <h2 className="text-yellow-200 text-2xl  text-center sm:text-3xl font-semibold mb-8"> Services</h2> */}

      <div className="grid grid-cols-1 sm:grid-cols-3 auto-rows-max gap-8 mx-auto max-w-fit">
        {services.map((service, index) => (
          <div
            key={index}
            className="bg-[#3b3f2f] w-56 py-3 rounded-2xl flex items-end justify-between px-5 cursor-pointer 
      hover:scale-105 transition-all duration-300 shadow-md"

            onClick={service.onclick}
          >
            <p className="text-yellow-200 w-20 text-lg font-bold">
              {service.title}
            </p>

            <Image
              src={service.icon}
              alt="Services"
              width={service.width * 0.75}
            />
          </div>
        ))}
      </div>

    </div>
  );
}
