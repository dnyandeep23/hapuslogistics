import { Icon } from "@iconify/react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { calculatePrice } from "@/services/logistics";
import Skeleton from "@/components/Skeleton";

export default function StepThree({ errors, setFormData, formData, pickupLocations, dropLocations, pricingInfo, setPricingInfo, userId }: any) {
    const pickUpLoc = pickupLocations.find((opt: any) => opt._id === formData.pickupLocationId);
    const dropLoc = dropLocations.find((opt: any) => opt._id === formData.dropLocationId);

    const [coupon, setCoupon] = useState(formData.coupon || "");
    const [couponStatus, setCouponStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [couponError, setCouponError] = useState("");

    const [isLoadingPrice, setIsLoadingPrice] = useState(false);
    const [pricingError, setPricingError] = useState<string | null>(null);

    useEffect(() => {
        setCoupon(formData.coupon || "");
    }, [formData.coupon]);

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
                } catch (error: any) {
                    console.error(error);
                    setCouponStatus(hasCoupon ? "error" : "idle");
                    setCouponError(error.message || "");
                    setPricingError(error.message || "An error occurred while calculating the price.");
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

    const handleCouponInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newCoupon = e.target.value.toUpperCase();
        setCoupon(newCoupon);
        if (formData.coupon) {
            setFormData({ ...formData, coupon: "" });
            setPricingInfo((prev: any) => ({
                ...prev,
                discount: 0,
                total: prev.subtotal,
                coupon: null,
            }));
        }
        setCouponStatus("idle");
        setCouponError("");
        setPricingError(null);
    };

    const pickupDate = formData.cart?.[0]?.pickUpDate
        ? formData.cart[0].pickUpDate.split("-").reverse().join("/")
        : "--/--/----";

    return (
        <div className="space-y-8 text-white">

            {/* Header */}
            <div className="text-[#F6FF6A]">
                <h2 className="text-3xl font-bold">Review & Checkout</h2>
                <p className="mt-1">Review your order details and proceed to payment</p>
            </div>

            {/* Location Information */}
            <div className="border relative border-[#F0FF73] bg-[#CDD645]/15 rounded-2xl p-5">
                <span className="bg-[#CDD645]/25  absolute top-0 text-[#F0FF73] px-4 py-1 rounded-b-xl text-sm font-semibold">
                    Location Information
                </span>

                <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:justify-between">
                    <div className="flex items-center gap-2">
                        <Icon icon="streamline-plump:location-pin-solid" className="text-green-400 text-3xl" />
                        <div>
                            <p className="text-sm text-[#F4FF9F]">Pickup Location</p>
                            <p className="font-bold text-[#e7f868]">{pickUpLoc?.name}</p>
                            <p className="text-[#e7f868] ">{pickUpLoc?.address}, {pickUpLoc?.city}, {pickUpLoc?.state} {pickUpLoc?.zip}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Icon icon="streamline-plump:location-pin-solid" className="text-red-400 text-3xl" />
                        <div>
                            <p className="text-sm text-[#F4FF9F]">Drop Location</p>
                            <p className="font-bold text-[#e7f868]">{dropLoc?.name}</p>
                            <p className="text-[#e7f868] ">{dropLoc?.address}, {dropLoc?.city}, {dropLoc?.state} {dropLoc?.zip}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Package Information */}
            <div className="border relative border-[#F0FF73] bg-[#CDD645]/15 rounded-2xl pt-6 pb-5 px-5">
                <span className="bg-[#CDD645]/25  absolute top-0 text-[#F0FF73] px-4 py-1 rounded-b-xl text-sm font-semibold">
                    Package Information
                </span>
                <div className="absolute top-3 bg-amber-600/30 border rounded-full border-amber-700/40 right-3 py-0.5 px-3 text-sm  text-white/90 flex items-center gap-2"> <Icon icon="solar:calendar-linear" className=" text-white text-base" /> <span>Pickup Date {pickupDate}</span>
                </div>

                <div className="space-y-3 mt-6">
                    {(pricingInfo?.items || formData.cart).map((item: any, index: number) => (
                        <div key={index} className="flex w-full bg-[#7277678b] rounded-xl">
                            {/* Image */}
                            <div className="relative -18 w-20 m-2 rounded-lg bg-black/10">
                                <Image
                                    src={item.packageImage}
                                    alt="Package Preview"
                                    fill
                                    className="object-cover rounded-lg"
                                />
                            </div>

                            {/* Content */}
                            <div className="flex items-center w-full relative justify-between px-4 py-3">
                                {/* Left Info */}
                                <div>
                                    <p className="font-semibold">
                                        {item.packageName || "Package"}
                                    </p>

                                    <p className="text-sm text-white/70">
                                        {item.packageSize} | {item.packageWeight} kg | Qty:{" "}
                                        {item.packageQuantities}
                                    </p>

                                    <p className="text-xs text-white/50">
                                        Pickup: {item.pickUpDate}
                                    </p>
                                </div>

                                {/* Package Type Badge */}
                                <span className="bg-[#CDD645]/30 absolute font-bold top-0 right-[20%] w-fit px-4 flex justify-center text-sm pt-1 pb-2 rounded-b-full">
                                    {item.packageType}
                                </span>

                                <div className="absolute top-2 right-4 text-lg font-bold">
                                    {isLoadingPrice ? (
                                        <Skeleton className="h-6 w-16" />
                                    ) : (
                                        item.price && `₹ ${item.price.toFixed(2)}`
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Sender & Receiver Info */}
            <div className="flex gap-6">

                {/* Sender */}
                <div className="flex-1 border relative border-[#F0FF73] bg-[#CDD645]/15 rounded-2xl p-5">
                    <span className="bg-[#CDD645]/25  absolute top-0 left-1/2 -translate-x-1/2 w-fit text-[#F0FF73] px-4 py-1 rounded-b-xl text-sm font-semibold">
                        Sender Information
                    </span>

                    <div className="mt-6 space-y-3">
                        <label className="mb-3">
                            Sender name <span className="text-red-400">*</span>
                        </label>
                        <div className="flex items-center pt-4 pb-2  gap-2 bg-[#1e241b] px-4 rounded-lg border-b-2 border-[#F0FF73]/60">
                            <Icon icon="heroicons:identification" className="text-[#F0FF73] text-xl" />
                            <input
                                placeholder="Sender Name"
                                value={formData.senderName}
                                onChange={(e) => {
                                    const clean = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                                    setFormData({ ...formData, senderName: clean });
                                }}
                                className="w-full text-base bg-transparent outline-none"
                            />
                        </div>
                        {errors.senderName && <p className="text-red-400 text-sm">{errors.senderName}</p>}

                        <label className="mb-3">
                            Sender contact no <span className="text-red-400">*</span>
                        </label>
                        <div className="flex items-center pt-4 pb-2  gap-2 bg-[#1e241b] px-4 rounded-lg border-b-2 border-[#F0FF73]/60">
                            <Icon icon="heroicons:phone" className="text-[#F0FF73] text-xl " />
                            <input
                                type="tel"
                                inputMode="numeric"
                                placeholder="Sender Contact No"
                                value={formData.senderContact}
                                onChange={(e) => {
                                    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                                    setFormData({ ...formData, senderContact: digitsOnly });
                                }}
                                className="w-full text-base bg-transparent outline-none"
                            />
                        </div>
                        {errors.senderContact && <p className="text-red-400 text-sm">{errors.senderContact}</p>}
                    </div>
                </div>


                {/* Receiver */}
                <div className="flex-1 border relative border-[#F0FF73] bg-[#CDD645]/15 rounded-2xl p-5">
                    <span className="bg-[#CDD645]/25 absolute top-0 left-1/2 -translate-x-1/2 w-fit text-[#F0FF73] px-4 py-1 rounded-b-xl text-sm font-semibold">
                        Receiver Information
                    </span>

                    <div className="mt-6 space-y-3">
                        <label className="mb-3">
                            Receiver name <span className="text-red-400">*</span>
                        </label>
                        <div className="flex items-center pt-4 pb-2  gap-2 bg-[#1e241b] px-4 rounded-lg border-b-2 border-[#F0FF73]/60">
                            <Icon icon="heroicons:identification" className="text-[#F0FF73] text-xl" />
                            <input
                                placeholder="Receiver Name"
                                value={formData.receiverName}
                                onChange={(e) => {
                                    const clean = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                                    setFormData({ ...formData, receiverName: clean });
                                }}
                                className="w-full text-base bg-transparent outline-none"
                            />
                        </div>
                        {errors.receiverName && <p className="text-red-400 text-sm">{errors.receiverName}</p>}
                        <label className="mb-3">
                            Receiver contact no <span className="text-red-400">*</span>
                        </label>
                        <div className="flex items-center pt-4 pb-2  gap-2 bg-[#1e241b] px-4 rounded-lg border-b-2 border-[#F0FF73]/60">
                            <Icon icon="heroicons:phone" className="text-[#F0FF73] text-xl " />
                            <input
                                type="tel"
                                inputMode="numeric"
                                placeholder="Receiver Contact No"
                                value={formData.receiverContact}
                                onChange={(e) => {
                                    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                                    setFormData({ ...formData, receiverContact: digitsOnly });
                                }}
                                className="w-full text-base bg-transparent outline-none"
                            />
                        </div>
                        {errors.receiverContact && <p className="text-red-400 text-sm">{errors.receiverContact}</p>}
                    </div>
                </div>
            </div>

            {/* Coupon & Amount */}
            <div className="flex justify-between items-start mt-6">

                {/* Coupon */}
                <div>
                    <p className="mb-2 font-semibold">Have a coupon code?</p>
                    {couponStatus === 'success' && pricingInfo.coupon ? (
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="bg-[#CDD645]/10 border border-[#F0FF73] justify-center min-w-sm h-16 text-[#F0FF73] font-bold px-3 py-1 rounded-lg flex items-center gap-2">

                                    <Icon icon="mdi:tick-decagram" />
                                    <span>{pricingInfo.coupon.code}</span>
                                </div>
                                <button
                                    onClick={() => handleCouponInputChange({ target: { value: "" } } as React.ChangeEvent<HTMLInputElement>)}
                                    className="text-sm text-gray-400 hover:text-white"
                                >
                                    Change
                                </button>
                            </div>
                            <p className="text-green-400 text-sm mt-1">Coupon applied! You got a {pricingInfo.coupon.discount}% discount.</p>
                        </div>
                    ) : (
                        <div>
                            <div className="flex gap-2">
                                <input
                                    placeholder="Enter Coupon Code"
                                    value={coupon}
                                    onChange={handleCouponInputChange}
                                    className="bg-[#1e241b] px-4 py-2 rounded-lg outline-none w-48"
                                />
                                <button
                                    onClick={handleApplyCoupon}
                                    className="bg-[#CDD645] text-black px-4 py-2 rounded-lg disabled:bg-gray-500"
                                    disabled={couponStatus === 'loading' || !coupon}
                                >
                                    {couponStatus === 'loading' ? "Applying..." : "Apply"}
                                </button>
                            </div>
                            {couponStatus === 'error' && <p className="text-red-400 text-sm mt-1">{couponError}</p>}

                            <div className="mt-3 flex flex-col items-start gap-2">
                                <span className="text-sm text-[#F0FF73]/80">Or select:</span>
                                {['HAPUS10', 'FIRST30'].map(code => (
                                <button
                                    key={code}
                                    onClick={() => {
                                        setCoupon(code);
                                        setCouponStatus("loading");
                                        setCouponError("");
                                        setFormData({ ...formData, coupon: code });
                                    }}
                                    className="bg-[#CDD645]/5 border-dashed border border-[#F0FF73] cursor-pointer min-w-sm h-16 rounded-md hover:bg-[#CDD645]/20 text-[#F0FF73] text-base flex items-center justify-center group font-mono px-2 py-1 gap-2 "
                                >
                                    <span>
                                        {code} </span> <span className="group-hover:flex hidden font-bold font-sans rounded-xl bg-green-500/30 px-1.5 py-0.5 text-xs items-center gap-0.5"> <Icon icon="mdi:tick-decagram" /> apply</span>
                                </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>


                {/* Amount */}
                <div className="text-right space-y-1 w-96">
                    {isLoadingPrice && (
                        <div className="space-y-2">
                            <Skeleton className="ml-auto h-4 w-44" />
                            <Skeleton className="ml-auto h-4 w-32" />
                            <Skeleton className="ml-auto h-4 w-28" />
                            <Skeleton className="ml-auto h-6 w-36" />
                        </div>
                    )}
                    {pricingError && <p className="text-red-400">{pricingError}</p>}
                    {!isLoadingPrice && !pricingError && pricingInfo && (
                        <>
                            <div className="border-b border-gray-600 pb-2 mb-2">
                                {pricingInfo.items.map((item: any, index: number) => {
                                    const unitPrice = item.price / item.packageQuantities;
                                    return (
                                        <div key={index} className="flex justify-between items-center text-sm mb-1">
                                            <span className="text-left">{item.packageName}</span>
                                            {item.packageQuantities > 1 ? (
                                                <div className="text-right">
                                                    <span>{item.packageQuantities} &times; ₹{unitPrice.toFixed(2)}</span>
                                                    <span className="ml-2">= ₹{item.price.toFixed(2)}</span>
                                                </div>
                                            ) : (
                                                <span>₹ {item.price.toFixed(2)}</span>
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
