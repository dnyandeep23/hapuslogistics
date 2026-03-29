"use client";

import { Icon } from "@iconify/react";
import Image from "next/image";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import type { CartItem, PackageFormData } from "@/app/package/types";

export default function Cart({
    formData,
    handleEditPackage,
    handleDeletePackage,
}: {
    formData: PackageFormData;
    handleEditPackage: (index: number) => void;
    handleDeletePackage: (index: number) => void;
}) {
    const { isMobile, isTablet } = useResponsiveMode();

    return (
        <div className={`package-panel mt-8 sm:mt-10 rounded-[1.6rem] sm:rounded-[1.8rem] ${isMobile ? "p-3" : "p-3.5 sm:p-6"}`}>

            <div className="package-badge inline-flex rounded-full px-3 md:px-4 py-1.5 md:py-2">
                <div className="flex items-center gap-1.5 md:gap-2 text-[13px] md:text-sm font-bold uppercase tracking-[0.14em]">
                    <Icon icon="mynaui:cart" className="text-base md:text-lg" />
                    <span>CART</span>
                </div>
            </div>

            <div className="mt-5 space-y-4">
                {!formData.cart || formData.cart.length === 0 ? (
                    <div className={`package-panel-soft flex flex-col items-center justify-center gap-4 rounded-[1.5rem] text-center text-white/60 ${isMobile ? "px-4 py-8" : "px-6 py-10"}`}>
                        <Icon icon='vaadin:cart-o' fontSize={isMobile ? 56 : 68} className="text-[#F6FF6A]/80" />
                        <div>
                            <p className="text-sm font-semibold text-[#F6FF6A]">Cart is empty</p>
                            <p className={`mt-1 ${isTablet ? "text-sm" : "text-[13px]"}`}>Add a package to continue to review and payment.</p>
                        </div>
                    </div>
                ) : (
                    <div className={isMobile ? "space-y-3" : "space-y-4"}>
                        {formData.cart.map((item, index: number) => (
                            <div key={index} className={`package-panel-soft flex flex-col overflow-hidden rounded-[1.3rem] sm:rounded-[1.4rem] ${isMobile ? "" : "sm:flex-row"}`}>
                                {/* Image */}
                                <div className={`relative mx-3 mt-3 rounded-xl bg-black/10 sm:mb-3 sm:mr-0 sm:min-w-28 ${isMobile ? "h-20" : "h-24 sm:h-28 sm:w-28"}`}>
                                    {typeof item.packageImage === "string" && item.packageImage ? (
                                        <Image
                                            src={item.packageImage}
                                            alt="Package Preview"
                                            fill
                                            className="object-cover rounded-lg"
                                        />
                                    ) : (
                                        <div className="flex h-full items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50">
                                            <Icon icon="solar:gallery-bold-duotone" className="text-3xl" />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className={`relative flex w-full flex-col gap-3 sm:gap-4 px-3.5 pb-3.5 pt-2 sm:px-4 sm:pb-4 ${isMobile ? "" : "sm:flex-row sm:items-end sm:justify-between sm:py-4"}`}>
                                    {/* Left Info */}
                                    <div className={`pr-0 ${isMobile ? "" : "sm:pr-24"}`}>
                                        <div className="mb-1.5 sm:mb-2 flex flex-wrap items-center gap-2">
                                            <p className="text-[15px] sm:text-base font-semibold text-[#F6FF6A]">
                                                {item.packageName || "Package"}
                                            </p>
                                            <span className="package-badge rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-semibold">
                                                {item.packageType}
                                            </span>
                                        </div>
                                        <p className={`text-white/70 ${isMobile ? "text-[12px]" : "text-[13px] sm:text-sm"}`}>
                                            {item.packageSize} | {item.packageWeight} kg | Qty:{" "}
                                            {item.packageQuantities}
                                        </p>

                                        <p className={`mt-0.5 sm:mt-1 ${isMobile ? "text-[10px]" : "text-[11px] sm:text-xs"} text-white/50`}>
                                            Pickup: {item.pickUpDate}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className={`flex items-center gap-2 self-end ${isMobile ? "pt-1" : "sm:self-auto"}`}>
                                        <button
                                            onClick={() => handleEditPackage(index)}
                                            className="rounded-full border border-white/15 bg-white/6 p-2 text-white/80 transition hover:bg-amber-200 hover:text-black/70"
                                            aria-label={`Edit package ${item.packageName || index + 1}`}
                                        >
                                            <Icon icon="mdi:pencil" className="text-xl" />
                                        </button>

                                        <button
                                            onClick={() => handleDeletePackage(index)}
                                            className="rounded-full border border-white/15 bg-white/6 p-2 text-white/80 transition hover:bg-red-300 hover:text-black/70"
                                            aria-label={`Delete package ${item.packageName || index + 1}`}
                                        >
                                            <Icon icon="mdi:delete" className="text-xl" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
}
