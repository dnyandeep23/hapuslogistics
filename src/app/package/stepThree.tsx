import { Icon } from "@iconify/react";
import Image from "next/image";
import { useState, useEffect, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { AvailableCoupon, calculatePrice, getAvailableCoupons, type PricingInfo } from "@/services/logistics";
import Skeleton from "@/components/Skeleton";
import { formatIndiaPhoneInput } from "@/lib/phone";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

type LocationOption = {
    _id: string;
    name: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
};

type CartItem = {
    packageImage: string;
    packageName?: string;
    packageSize: string;
    packageWeight: number;
    packageQuantities: number;
    packageType?: string;
    pickUpDate?: string;
    price?: number;
};

type FormDataState = {
    pickupLocationId: string;
    dropLocationId: string;
    coupon?: string;
    senderName: string;
    senderContact: string;
    receiverName: string;
    receiverContact: string;
    cart: CartItem[];
};

type StepThreeProps = {
    errors: Record<string, string>;
    setFormData: (next: FormDataState) => void;
    formData: FormDataState;
    pickupLocations: LocationOption[];
    dropLocations: LocationOption[];
    pricingInfo: PricingInfo | null;
    setPricingInfo: Dispatch<SetStateAction<PricingInfo | null>>;
    userId?: string;
};

export default function StepThree({ errors, setFormData, formData, pickupLocations, dropLocations, pricingInfo, setPricingInfo, userId }: StepThreeProps) {
    const { isMobile, isTablet, isDesktop } = useResponsiveMode();
    const pickUpLoc = pickupLocations.find((opt) => opt._id === formData.pickupLocationId);
    const dropLoc = dropLocations.find((opt) => opt._id === formData.dropLocationId);
    const displayedItems = formData.cart.map((item, index) => ({
        ...item,
        price: pricingInfo?.items?.[index]?.price ?? item.price,
    }));

    const [coupon, setCoupon] = useState(formData.coupon || "");
    const [couponStatus, setCouponStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [couponError, setCouponError] = useState("");
    const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([]);
    const [isLoadingCoupons, setIsLoadingCoupons] = useState(false);
    const [showAllPackages, setShowAllPackages] = useState(false);

    const [isLoadingPrice, setIsLoadingPrice] = useState(false);
    const [pricingError, setPricingError] = useState<string | null>(null);

    useEffect(() => {
        setCoupon(formData.coupon || "");
    }, [formData.coupon]);

    useEffect(() => {
        let isMounted = true;

        const loadAvailableCoupons = async () => {
            if (!userId) {
                setAvailableCoupons([]);
                setIsLoadingCoupons(false);
                return;
            }
            setIsLoadingCoupons(true);
            const coupons = await getAvailableCoupons(String(userId));
            if (!isMounted) return;

            const sortedCoupons = [...coupons].sort((left, right) => {
                if (right.discount !== left.discount) return right.discount - left.discount;
                return left.code.localeCompare(right.code);
            });

            setAvailableCoupons(sortedCoupons);
            setIsLoadingCoupons(false);
        };

        loadAvailableCoupons();
        return () => {
            isMounted = false;
        };
    }, [userId]);

    useEffect(() => {
        const fetchPrice = async () => {
            if (formData.cart.length > 0 && formData.pickupLocationId && formData.dropLocationId && userId) {
                const hasCoupon = Boolean(formData.coupon);
                setIsLoadingPrice(true);
                setPricingError(null);
                setCouponError("");
                setCouponStatus(hasCoupon ? "loading" : "idle");
                try {
                    const data = await calculatePrice(
                        formData.cart,
                        formData.coupon,
                        userId,
                        formData.pickupLocationId,
                        formData.dropLocationId
                    );
                    setPricingInfo(data);
                    if (hasCoupon && data.coupon) {
                        setCouponStatus("success");
                        setCoupon(data.coupon.code);
                    } else if (hasCoupon) {
                        setCouponStatus("error");
                        setCouponError("Invalid or expired coupon");
                    } else {
                        setCouponStatus("idle");
                    }
                } catch (error: unknown) {
                    console.error(error);
                    const errorMessage = error instanceof Error ? error.message : "";
                    setCouponStatus(hasCoupon ? "error" : "idle");
                    setCouponError(errorMessage);
                    setPricingError(errorMessage || "An error occurred while calculating the price.");
                } finally {
                    setIsLoadingPrice(false);
                }
            }
        };
        fetchPrice();
    }, [
        formData.cart,
        formData.pickupLocationId,
        formData.dropLocationId,
        formData.coupon,
        userId,
        setPricingInfo,
    ]);


    const handleApplyCoupon = () => {
        const normalizedCoupon = coupon.trim().toUpperCase();
        setCoupon(normalizedCoupon);
        setCouponError("");
        setCouponStatus(normalizedCoupon ? "loading" : "idle");
        setFormData({ ...formData, coupon: normalizedCoupon });
    };

    const handleCouponInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const newCoupon = e.target.value.toUpperCase();
        setCoupon(newCoupon);
        if (formData.coupon) {
            setFormData({ ...formData, coupon: "" });
            setPricingInfo((prev) =>
                prev
                    ? {
                        ...prev,
                        discount: 0,
                        total: Number(prev?.subtotal ?? prev?.total ?? 0),
                        coupon: null,
                    }
                    : prev
            );
        }
        setCouponStatus("idle");
        setCouponError("");
        setPricingError(null);
    };

    const handleSelectCoupon = (selectedCode: string) => {
        setCoupon(selectedCode);
        setCouponStatus("loading");
        setCouponError("");
        setFormData({ ...formData, coupon: selectedCode });
    };

    const formatExpiryLabel = (value: string | null) => {
        if (!value) return "No Expiry";
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return "Expiry N/A";
        return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    };
    const shouldShowCouponSection =
        isLoadingCoupons ||
        availableCoupons.length > 0 ||
        Boolean(formData.coupon) ||
        couponStatus === "loading" ||
        couponStatus === "success" ||
        couponStatus === "error";

    const pickupDate = formData.cart?.[0]?.pickUpDate
        ? formData.cart[0].pickUpDate.split("-").reverse().join("/")
        : "--/--/----";
    const visibleItems = isMobile && !showAllPackages ? displayedItems.slice(0, 1) : displayedItems;
    const hasCartItems = displayedItems.length > 0;

    return (
        <div className="space-y-5 text-white sm:space-y-8">

            {/* Header */}
            <div className="max-w-2xl text-[#F6FF6A]">
                <h2 className="text-xl font-bold sm:text-3xl">{isMobile ? "Review before paying" : "Review & Checkout"}</h2>
                <p className="mt-1.5 md:mt-2 text-[13px] leading-5 text-white/68 sm:text-base sm:leading-6">
                    {isMobile
                        ? "Phone view shows the essentials first. Expand package details only when needed."
                        : isTablet
                            ? "Tablet keeps route, package, and checkout details balanced."
                            : "Review your order details and proceed to payment."}
                </p>
            </div>

            {/* Location Information */}
            <div className="package-panel relative rounded-[1.4rem] md:rounded-[1.6rem] p-3.5 pt-6 sm:p-5 sm:pt-6">
                <span className="package-badge absolute top-0 rounded-b-xl px-2.5 md:px-4 py-0.5 md:py-1 text-[11px] md:text-sm font-semibold">
                    Location Information
                </span>

                <div className={`mt-4 md:mt-6 grid gap-3 lg:gap-4 ${isDesktop ? "lg:grid-cols-2" : ""}`}>
                    <div className="package-panel-soft flex items-start gap-2 md:gap-3 rounded-[1.3rem] p-3 md:p-4">
                        <Icon icon="streamline-plump:location-pin-solid" className="text-green-400 text-2xl md:text-3xl" />
                        <div>
                            <p className="text-xs md:text-sm text-[#F4FF9F]">Pickup Location</p>
                            <p className="font-bold text-sm md:text-base text-[#e7f868]">{pickUpLoc?.name || "Select a pickup location"}</p>
                            <p className="mt-0.5 md:mt-1 text-xs md:text-sm text-white/65">
                                {pickUpLoc ? `${pickUpLoc.address || "--"}, ${pickUpLoc.city || "--"}, ${pickUpLoc.state || "--"} ${pickUpLoc.zip || ""}` : "Route details will appear here."}
                            </p>
                        </div>
                    </div>

                    <div className="package-panel-soft flex items-start gap-2 md:gap-3 rounded-[1.3rem] p-3 md:p-4">
                        <Icon icon="streamline-plump:location-pin-solid" className="text-red-400 text-2xl md:text-3xl" />
                        <div>
                            <p className="text-xs md:text-sm text-[#F4FF9F]">Drop Location</p>
                            <p className="font-bold text-sm md:text-base text-[#e7f868]">{dropLoc?.name || "Select a drop location"}</p>
                            <p className="mt-0.5 md:mt-1 text-xs md:text-sm text-white/65">
                                {dropLoc ? `${dropLoc.address || "--"}, ${dropLoc.city || "--"}, ${dropLoc.state || "--"} ${dropLoc.zip || ""}` : "Destination details will appear here."}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Package Information */}
            <div className="package-panel relative rounded-[1.4rem] md:rounded-[1.6rem] px-3.5 pb-3.5 pt-6 sm:px-5 sm:pb-5 sm:pt-6">
                <span className="package-badge absolute top-0 rounded-b-xl px-2.5 md:px-4 py-0.5 md:py-1 text-[11px] md:text-sm font-semibold">
                    Package Information
                </span>
                <div className="package-badge absolute right-3 top-3 flex max-w-[calc(100%-1.5rem)] items-center gap-1 md:gap-2 rounded-full px-2 md:px-3 py-1 text-[10px] md:text-sm text-white/90"> <Icon icon="solar:calendar-linear" className=" text-white text-sm md:text-base" /> <span>Pickup Date {pickupDate}</span>
                </div>

                <div className="mt-6 space-y-3">
                    {!hasCartItems ? (
                        <div className="package-panel-soft rounded-[1.3rem] p-4 text-sm text-white/70">
                            No packages are in the cart yet. Add at least one package before reviewing payment.
                        </div>
                    ) : null}
                    {visibleItems.map((item: CartItem, index: number) => (
                        <div key={index} className="package-panel-soft flex flex-col overflow-hidden rounded-[1.3rem] sm:flex-row">
                            {/* Image */}
                            <div className="relative mx-3 mt-3 h-24 rounded-xl bg-black/10 sm:mb-3 sm:mr-0 sm:w-24 sm:min-w-24">
                                <Image
                                    src={item.packageImage}
                                    alt="Package Preview"
                                    fill
                                    className="object-cover rounded-lg"
                                />
                            </div>

                            {/* Content */}
                            <div className="relative flex w-full flex-col gap-3 px-4 pb-4 pt-2 sm:flex-row sm:items-end sm:justify-between sm:py-4">
                                {/* Left Info */}
                                <div className="pr-0 sm:pr-24">
                                    <div className="mb-1 md:mb-2 flex flex-wrap items-center gap-2">
                                        <p className="font-semibold text-sm md:text-base text-[#F6FF6A]">
                                            {item.packageName || "Package"}
                                        </p>
                                        <span className="package-badge rounded-full px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-[11px] font-semibold">
                                            {item.packageType}
                                        </span>
                                    </div>
                                    <p className="text-xs md:text-sm text-white/70">
                                        {item.packageSize} | {item.packageWeight} kg | Qty:{" "}
                                        {item.packageQuantities}
                                    </p>

                                    <p className="text-[10px] md:text-xs text-white/50">
                                        Pickup: {item.pickUpDate}
                                    </p>
                                </div>

                                <div className="text-lg font-bold sm:absolute sm:right-4 sm:top-2">
                                    {isLoadingPrice ? (
                                        <Skeleton className="h-6 w-16" />
                                    ) : (
                                        Number.isFinite(Number(item.price)) ? `₹ ${Number(item.price).toFixed(2)}` : ""
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {isMobile && displayedItems.length > 1 ? (
                    <button
                        type="button"
                        onClick={() => setShowAllPackages((prev) => !prev)}
                        className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-[#F6FF6A]"
                    >
                        <Icon icon={showAllPackages ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} className="text-sm" />
                        {showAllPackages ? "Show fewer packages" : `View ${displayedItems.length - 1} more package${displayedItems.length > 2 ? "s" : ""}`}
                    </button>
                ) : null}
                {!isMobile && !hasCartItems ? (
                    <p className="mt-3 text-sm text-white/55">Package details will appear here once items are added.</p>
                ) : null}
            </div>

            {/* Sender & Receiver Info */}
            <div className={`grid gap-4 ${isDesktop ? "lg:grid-cols-2" : ""}`}>

                {/* Sender */}
                <div className="package-panel relative rounded-[1.4rem] md:rounded-[1.6rem] p-3.5 pt-6 sm:p-5 sm:pt-6">
                    <span className="package-badge absolute left-1/2 top-0 w-fit -translate-x-1/2 rounded-b-xl px-2.5 md:px-4 py-0.5 md:py-1 text-[11px] md:text-sm font-semibold">
                        Sender Information
                    </span>

                    <div className="mt-4 md:mt-6 space-y-3">
                        <label className="mb-2 md:mb-3 block text-xs md:text-sm font-medium text-white/85">
                            Sender name <span className="text-red-400">*</span>
                        </label>
                        <div className="package-input flex items-center gap-2 rounded-xl md:rounded-2xl px-3 md:px-4 py-2 md:py-3">
                            <Icon icon="heroicons:identification" className="text-[#F0FF73] text-lg md:text-xl" />
                            <input
                                placeholder="Sender Name"
                                value={formData.senderName}
                                onChange={(e) => {
                                    const clean = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                                    setFormData({ ...formData, senderName: clean });
                                }}
                                className="w-full text-sm md:text-base bg-transparent outline-none"
                            />
                        </div>
                        {errors.senderName && <p className="text-red-400 text-xs md:text-sm">{errors.senderName}</p>}

                        <label className="mb-2 md:mb-3 block text-xs md:text-sm font-medium text-white/85">
                            Sender contact no <span className="text-red-400">*</span>
                        </label>
                        <div className="package-input flex items-center gap-2 rounded-xl md:rounded-2xl px-3 md:px-4 py-2 md:py-3">
                            <Icon icon="heroicons:phone" className="text-[#F0FF73] text-lg md:text-xl " />
                            <input
                                type="tel"
                                inputMode="numeric"
                                placeholder="+91 9876543210"
                                value={formData.senderContact || formatIndiaPhoneInput("")}
                                onChange={(e) => {
                                    setFormData({ ...formData, senderContact: formatIndiaPhoneInput(e.target.value) });
                                }}
                                className="w-full text-sm md:text-base bg-transparent outline-none"
                            />
                        </div>
                        {errors.senderContact && <p className="text-red-400 text-xs md:text-sm">{errors.senderContact}</p>}
                    </div>
                </div>


                {/* Receiver */}
                <div className="package-panel relative rounded-[1.4rem] md:rounded-[1.6rem] p-3.5 pt-6 sm:p-5 sm:pt-6">
                    <span className="package-badge absolute left-1/2 top-0 w-fit -translate-x-1/2 rounded-b-xl px-2.5 md:px-4 py-0.5 md:py-1 text-[11px] md:text-sm font-semibold">
                        Receiver Information
                    </span>

                    <div className="mt-4 md:mt-6 space-y-3">
                        <label className="mb-2 md:mb-3 block text-xs md:text-sm font-medium text-white/85">
                            Receiver name <span className="text-red-400">*</span>
                        </label>
                        <div className="package-input flex items-center gap-2 rounded-xl md:rounded-2xl px-3 md:px-4 py-2 md:py-3">
                            <Icon icon="heroicons:identification" className="text-[#F0FF73] text-lg md:text-xl" />
                            <input
                                placeholder="Receiver Name"
                                value={formData.receiverName}
                                onChange={(e) => {
                                    const clean = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                                    setFormData({ ...formData, receiverName: clean });
                                }}
                                className="w-full text-sm md:text-base bg-transparent outline-none"
                            />
                        </div>
                        {errors.receiverName && <p className="text-red-400 text-xs md:text-sm">{errors.receiverName}</p>}
                        <label className="mb-2 md:mb-3 block text-xs md:text-sm font-medium text-white/85">
                            Receiver contact no <span className="text-red-400">*</span>
                        </label>
                        <div className="package-input flex items-center gap-2 rounded-xl md:rounded-2xl px-3 md:px-4 py-2 md:py-3">
                            <Icon icon="heroicons:phone" className="text-[#F0FF73] text-lg md:text-xl " />
                            <input
                                type="tel"
                                inputMode="numeric"
                                placeholder="+91 9876543210"
                                value={formData.receiverContact || formatIndiaPhoneInput("")}
                                onChange={(e) => {
                                    setFormData({ ...formData, receiverContact: formatIndiaPhoneInput(e.target.value) });
                                }}
                                className="w-full text-sm md:text-base bg-transparent outline-none"
                            />
                        </div>
                        {errors.receiverContact && <p className="text-red-400 text-xs md:text-sm">{errors.receiverContact}</p>}
                    </div>
                </div>
            </div>

            {/* Coupon & Amount */}
            <div className={`mt-6 flex flex-col gap-4 ${isDesktop ? `xl:flex-row xl:items-start ${shouldShowCouponSection ? "xl:justify-between" : "xl:justify-end"}` : ""}`}>

                {/* Coupon */}
                {shouldShowCouponSection ? (
                <div className="package-panel flex-1 rounded-[1.4rem] md:rounded-[1.6rem] p-3.5 sm:p-5">
                    <p className="mb-2 text-[13px] md:text-sm font-semibold">Have a coupon code?</p>
                    {couponStatus === 'success' && pricingInfo?.coupon ? (
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="package-panel-soft flex h-16 min-w-[220px] items-center justify-center gap-2 rounded-2xl px-3 py-1 font-bold text-[#F0FF73]">

                                    <Icon icon="mdi:tick-decagram" />
                                    <span>{pricingInfo.coupon.code}</span>
                                </div>
                                <button
                                    onClick={() => handleCouponInputChange({ target: { value: "" } } as ChangeEvent<HTMLInputElement>)}
                                    className="text-sm text-gray-400 hover:text-white"
                                >
                                    Change
                                </button>
                            </div>
                            <p className="text-green-400 text-sm mt-1">Coupon applied! You got a {pricingInfo.coupon.discount}% discount.</p>
                        </div>
                    ) : (
                        <div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    placeholder="Enter Coupon Code"
                                    value={coupon}
                                    onChange={handleCouponInputChange}
                                    className="package-input w-full rounded-2xl px-4 py-2 sm:w-56"
                                />
                                <button
                                    onClick={handleApplyCoupon}
                                    className="rounded-2xl bg-[#CDD645] px-4 py-2 text-black transition hover:bg-[#dbe86b] disabled:bg-gray-500"
                                    disabled={couponStatus === 'loading' || !coupon}
                                >
                                    {couponStatus === 'loading' ? "Applying..." : "Apply"}
                                </button>
                            </div>
                            {couponStatus === 'error' && <p className="text-red-400 text-sm mt-1">{couponError}</p>}

                            <div className="mt-3 flex flex-col items-start gap-2">
                                <span className="text-sm text-[#F0FF73]/80">
                                    Available coupons (highest discount first):
                                </span>
                                {isLoadingCoupons ? (
                                    <div className="flex w-full max-w-[720px] gap-2 overflow-x-auto pb-1">
                                        {Array.from({ length: 3 }).map((_, index) => (
                                            <div key={`coupon-list-skeleton-${index}`} className="min-w-[220px] rounded-xl border border-white/20 bg-black/20 p-3">
                                                <Skeleton className="h-4 w-24" />
                                                <Skeleton className="mt-2 h-3 w-32" />
                                                <Skeleton className="mt-2 h-3 w-20" />
                                            </div>
                                        ))}
                                    </div>
                                ) : availableCoupons.length > 0 ? (
                                    <div className="flex w-full max-w-[720px] gap-2 overflow-x-auto pb-1">
                                        {availableCoupons.map((availableCoupon) => {
                                            const isSelected = coupon === availableCoupon.code || formData.coupon === availableCoupon.code;
                                            return (
                                                <button
                                                    type="button"
                                                    key={availableCoupon.id}
                                                    onClick={() => handleSelectCoupon(availableCoupon.code)}
                                                    className={`min-w-[220px] rounded-2xl border px-3 py-2 text-left transition ${
                                                        isSelected
                                                            ? "border-[#F0FF73] bg-[#CDD645]/20"
                                                            : "border-[#F0FF73]/40 bg-[#CDD645]/5 hover:bg-[#CDD645]/15"
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-mono text-base text-[#F0FF73]">{availableCoupon.code}</span>
                                                        <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-300">
                                                            {availableCoupon.discount}% OFF
                                                        </span>
                                                    </div>
                                                    <div className="mt-2 text-xs text-white/70">
                                                        <p>{formatExpiryLabel(availableCoupon.expiryDate)}</p>
                                                        <p>
                                                            Remaining uses: {availableCoupon.remainingUses}/{availableCoupon.maxUsesPerUser}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                                        No coupons are available right now.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                ) : null}


                {/* Amount */}
                <div className={`package-panel w-full rounded-[1.4rem] md:rounded-[1.6rem] p-3.5 text-right space-y-1 sm:p-5 ${isDesktop ? "xl:w-96" : ""}`}>
                    {isLoadingPrice && (
                        <div className="space-y-2">
                            <Skeleton className="ml-auto h-4 w-44" />
                            <Skeleton className="ml-auto h-4 w-32" />
                            <Skeleton className="ml-auto h-4 w-28" />
                            <Skeleton className="ml-auto h-6 w-36" />
                        </div>
                    )}
                    {pricingError && <p className="text-red-400">{pricingError}</p>}
                    {!isLoadingPrice && !pricingError && !pricingInfo ? (
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/60">
                            Pricing will appear after route and package details are ready.
                        </div>
                    ) : null}
                    {!isLoadingPrice && !pricingError && pricingInfo && (
                        <>
                            <div className="border-b border-gray-600 pb-2 mb-2">
                                {displayedItems.map((item: CartItem, index: number) => {
                                    const quantity = Number(item.packageQuantities) || 0;
                                    const totalPrice = Number(item.price) || 0;
                                    const unitPrice = quantity > 0 ? totalPrice / quantity : totalPrice;
                                    return (
                                        <div key={index} className="flex justify-between items-center text-sm mb-1">
                                            <span className="text-left">{item.packageName}</span>
                                            {quantity > 1 ? (
                                                <div className="text-right">
                                                    <span>{quantity} &times; ₹{unitPrice.toFixed(2)}</span>
                                                    <span className="ml-2">= ₹{totalPrice.toFixed(2)}</span>
                                                </div>
                                            ) : (
                                                <span>₹ {totalPrice.toFixed(2)}</span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>₹ {pricingInfo.subtotal.toFixed(2)}</span>
                            </div>
                            {pricingInfo.discount > 0 && (
                                <div className="flex justify-between text-green-400">
                                    <span>Discount</span>
                                    <span>- ₹ {pricingInfo.discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="font-bold text-lg flex justify-between mt-2 pt-2 border-t border-gray-500">
                                <span>Total Amount</span>
                                <span>₹ {pricingInfo.total.toFixed(2)}</span>
                            </div>
                        </>
                    )}
                </div>

            </div>

        </div >
    );
}
