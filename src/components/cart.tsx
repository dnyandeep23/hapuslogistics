import { Icon } from "@iconify/react";
import Image from "next/image";
export default function Cart({
    formData,
    handleEditPackage,
    handleDeletePackage,
}: any) {

    return (
        <div className="mt-12 relative bg-[#4b553c]/70 rounded-4xl p-6">

            <div className="absolute bg-[#F0FF73]/30 rounded-t-3xl -top-8 left-7 px-4 py-1.5">
                <div className="flex items-end gap-2 text-sm  font-bold">
                    <Icon icon="mynaui:cart" fontSize={20} />
                    <span>CART</span>
                </div>
            </div>

            <div className="space-y-4 mt-4">
                {!formData.cart || formData.cart.length === 0 ? (
                    <div className="mt-10 flex flex-col items-center justify-center gap-5 text-white/60 text-center">
                        <Icon icon='vaadin:cart-o' fontSize={75} /> <span>Your cart is empty. <br />Add a package to cart.</span>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {formData.cart.map((item: any, index: number) => (
                            <div key={index} className="flex w-full bg-[#5a6445] rounded-xl">
                                {/* Image */}
                                <div className="relative h-18 w-20 m-2 rounded-lg bg-black/10">
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
                                    <span className="bg-[#CDD645]/30 absolute top-0 right-[8%] w-[16%] flex justify-center text-xs px-4 pt-1 pb-2 rounded-b-full">
                                        {item.packageType}
                                    </span>

                                    {/* Actions */}
                                    <div className="h-full flex items-end gap-1">
                                        <button
                                            onClick={() => handleEditPackage(index)}
                                            className="hover:text-black/60 cursor-pointer p-2 rounded-full border hover:bg-amber-200"
                                        >
                                            <Icon icon="mdi:pencil" className="text-xl" />
                                        </button>

                                        <button
                                            onClick={() => handleDeletePackage(index)}
                                            className="hover:text-black/60 cursor-pointer p-2 rounded-full border hover:bg-red-300"
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
