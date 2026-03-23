import { Icon } from "@iconify/react";
import Image from "next/image";
export default function Cart({
    formData,
    handleEditPackage,
    handleDeletePackage,
}: any) {

    return (
        <div className="package-panel mt-10 rounded-[1.8rem] p-4 sm:p-6">

            <div className="package-badge inline-flex rounded-full px-4 py-2">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em]">
                    <Icon icon="mynaui:cart" fontSize={18} />
                    <span>CART</span>
                </div>
            </div>

            <div className="mt-5 space-y-4">
                {!formData.cart || formData.cart.length === 0 ? (
                    <div className="package-panel-soft flex flex-col items-center justify-center gap-4 rounded-[1.5rem] px-6 py-10 text-center text-white/60">
                        <Icon icon='vaadin:cart-o' fontSize={68} className="text-[#F6FF6A]/80" />
                        <span>Your cart is empty. <br />Add a package to cart.</span>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {formData.cart.map((item: any, index: number) => (
                            <div key={index} className="package-panel-soft flex flex-col overflow-hidden rounded-[1.4rem] sm:flex-row">
                                {/* Image */}
                                <div className="relative mx-3 mt-3 h-28 rounded-xl bg-black/10 sm:mb-3 sm:mr-0 sm:w-28 sm:min-w-28">
                                    <Image
                                        src={item.packageImage}
                                        alt="Package Preview"
                                        fill
                                        className="object-cover rounded-lg"
                                    />
                                </div>

                                {/* Content */}
                                <div className="relative flex w-full flex-col gap-4 px-4 pb-4 pt-2 sm:flex-row sm:items-end sm:justify-between sm:py-4">
                                    {/* Left Info */}
                                    <div className="pr-0 sm:pr-24">
                                        <div className="mb-2 flex flex-wrap items-center gap-2">
                                            <p className="font-semibold text-[#F6FF6A]">
                                                {item.packageName || "Package"}
                                            </p>
                                            <span className="package-badge rounded-full px-3 py-1 text-[11px] font-semibold">
                                                {item.packageType}
                                            </span>
                                        </div>
                                        <p className="text-sm text-white/70">
                                            {item.packageSize} | {item.packageWeight} kg | Qty:{" "}
                                            {item.packageQuantities}
                                        </p>

                                        <p className="mt-1 text-xs text-white/50">
                                            Pickup: {item.pickUpDate}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 self-end sm:self-auto">
                                        <button
                                            onClick={() => handleEditPackage(index)}
                                            className="rounded-full border border-white/15 bg-white/6 p-2 text-white/80 transition hover:bg-amber-200 hover:text-black/70"
                                        >
                                            <Icon icon="mdi:pencil" className="text-xl" />
                                        </button>

                                        <button
                                            onClick={() => handleDeletePackage(index)}
                                            className="rounded-full border border-white/15 bg-white/6 p-2 text-white/80 transition hover:bg-red-300 hover:text-black/70"
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
