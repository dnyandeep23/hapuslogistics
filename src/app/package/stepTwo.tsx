import { Icon } from "@iconify/react";
import { useState } from "react";
import DropzoneUpload from "../../components/DropzoneUpload";
import Cart from "../../components/cart";
import CustomDatePicker from "@/components/CustomDatePicker";

const packageTypes = [
    { id: "wooden", label: "Wooden", icon: "mdi:tree" },
    { id: "plastic", label: "Plastic / Fibre", icon: "mdi:bottle-soda" },
    { id: "iron", label: "Iron", icon: "mdi:anvil" },
    { id: "electronics", label: "Electronics", icon: "mdi:flash" },
    { id: "mango", label: "Mango Box", icon: "mdi:package-variant" },
    { id: "other", label: "Other", icon: "mdi:shape-outline" },
];

const packageSizes = [
    {
        label: "Small",
        desc: "Up to 40 × 40 cm | Max 5 kg",
        scale: 1,
    },
    {
        label: "Medium",
        desc: "Up to 60 × 60 cm | Max 10 kg",
        scale: 1.2,
    },
    {
        label: "Large",
        desc: "Up to 100 × 100 cm | Max 20 kg",
        scale: 1.4,
    },
];


export function PackageSizeSelector({ currentPackage, setCurrentPackage }: any) {
    const [index, setIndex] = useState(0);
    const [direction, setDirection] = useState<"left" | "right">("right");



    const handleNext = () => {
        setDirection("right");
        const next = (index + 1) % packageSizes.length;
        setIndex(next);
        setCurrentPackage({
            ...currentPackage,
            packageSize: packageSizes[next].label,
        });
    };

    const handlePrev = () => {
        setDirection("left");
        const prev = (index - 1 + packageSizes.length) % packageSizes.length;
        setIndex(prev);
        setCurrentPackage({
            ...currentPackage,
            packageSize: packageSizes[prev].label,
        });
    };

    return (
        <div className="flex flex-col items-start w-full lg:w-1/3 overflow-hidden">
            <label className="mb-3">
                Select package size <span className="text-red-400">*</span>
            </label>

            <div className="flex items-center w-full justify-center gap-6 sm:gap-12">
                <button onClick={handlePrev} className="w-10 h-10 rounded-full bg-[#1e241b]">
                    ◀
                </button>

                <Icon
                    icon="noto:package"
                    className="text-[#d2a679] transition-transform duration-1000 h-44"
                    style={{
                        fontSize: "120px",
                        transform: `scale(${packageSizes[index].scale})`,
                    }}
                />

                <button onClick={handleNext} className="w-10 h-10 rounded-full bg-[#1e241b]">
                    ▶
                </button>
            </div>

            <div className="relative w-full mt-4 h-16 overflow-hidden text-center bg-black/50 rounded-lg">
                <div
                    key={index}
                    className={`absolute inset-0 transition-all duration-700 flex flex-col items-center justify-center
            ${direction === "right" ? "animate-slideInRight" : "animate-slideInLeft"}`}
                >
                    <p className="font-semibold">{packageSizes[index].label}</p>
                    <p className="text-sm text-white/60">{packageSizes[index].desc}</p>
                </div>
            </div>
        </div>
    );
}

export default function StepTwo({
    formData,
    setFormData,
    currentPackage,
    setCurrentPackage,
    errors,
    handleAddToCart,
    handleClearForm,
    editIndex,
    handleEdit,
    handleDelete,
    handleFileDrop,
    isUploadingPackageImage,
}: any) {

    const handleDateChange = (date: string) => {
        setCurrentPackage({ ...currentPackage, pickUpDate: date });
    };

    const firstCartItemDate = formData.cart[0]?.pickUpDate;
    const hasDateConflict =
        formData.cart.length > 0 &&
        editIndex === null &&
        firstCartItemDate &&
        currentPackage.pickUpDate &&
        currentPackage.pickUpDate !== firstCartItemDate;

    const datePickerError = errors.pickUpDate || (hasDateConflict ? 'Changing this date will update the date for all packages in the cart.' : undefined);


    const handleAddToCartClick = () => {
        if (hasDateConflict) {
            setFormData({
                ...formData,
                cart: formData.cart.map((item: any) => ({
                    ...item,
                    pickUpDate: currentPackage.pickUpDate,
                })),
            });
        }
        handleAddToCart();
    };

    return (
        <div className="space-y-5 text-[#f7fac7]">
            <div className="text-[#F6FF6A]">
                <h2 className="text-3xl font-bold">Package Details</h2>
                <p className="mt-1">Provide details of the package you want to send</p>
            </div>


            {/* Package Name */}
            <div className="flex flex-col">
                <label className="mb-2">Package Name (optional)</label>
                <input
                    placeholder="Package Name"
                    className="bg-[#1e241b] px-4 pt-4 pb-2 rounded-lg border-b-2 border-[#CDD645]/60 focus:border-[#CDD645]"
                    value={currentPackage.packageName}
                    onChange={(e) =>
                        setCurrentPackage({ ...currentPackage, packageName: e.target.value })
                    }
                />
                {errors.packageName && <p className="text-red-400 text-sm">{errors.packageName}</p>}
            </div>

            {/* Package Type */}
            <div className="flex flex-col">
                <label className="mb-2">
                    Select package type <span className="text-red-400">*</span>
                </label>

                <div className="flex gap-3 flex-wrap">
                    {packageTypes.map((pkg) => (
                        <button
                            key={pkg.id}
                            type="button"
                            onClick={() =>
                                setCurrentPackage({ ...currentPackage, packageType: pkg.label })
                            }
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border
                ${currentPackage.packageType === pkg.label
                                    ? "bg-[#F6FF6A] text-black"
                                    : "bg-[#1e241b] border-white/20"
                                }`}
                        >
                            <Icon icon={pkg.icon} className="text-xl" />
                            {pkg.label}
                        </button>
                    ))}
                </div>
                {errors.packageType && <p className="text-red-400 text-sm">{errors.packageType}</p>}
            </div>

            {/* Other Type */}
            {currentPackage.packageType === "Other" && (
                <div className="flex flex-col mt-4">
                    <label>Specify (Other type)</label>
                    <input
                        className="bg-[#1e241b] px-4 pt-4 pb-2 rounded-lg border-b-2 border-[#CDD645]/60"
                        value={currentPackage.otherPackageType}
                        onChange={(e) =>
                            setCurrentPackage({
                                ...currentPackage,
                                otherPackageType: e.target.value,
                            })
                        }
                    />
                    {errors.otherPackageType && (
                        <p className="text-red-400 text-sm">{errors.otherPackageType}</p>
                    )}
                </div>
            )}

            <div className="mt-8 flex flex-col gap-6 lg:flex-row">
                <PackageSizeSelector
                    currentPackage={currentPackage}
                    setCurrentPackage={setCurrentPackage}
                />

                {/* Middle Section */}
                <div className="flex w-full flex-col gap-5 lg:w-1/3">
                    {/* Weight */}
                    <div>
                        <label>Enter weight <span className="text-red-400 ">*</span></label>
                        <input
                            type="number"
                            min={0}
                            max={100}
                            className={`${errors.packageWeight ? "border-red-500" : "border-[#CDD645]/60"} border-b-2 bg-[#1e241b] w-full px-4 py-3 rounded-xl`}
                            value={currentPackage.packageWeight}
                            onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === "") {
                                    setCurrentPackage({ ...currentPackage, packageWeight: "" });
                                    return;
                                }
                                let next = Number(raw);
                                if (Number.isNaN(next)) return;
                                if (next > 100) next = 100;
                                if (next < 0) next = 0;
                                setCurrentPackage({ ...currentPackage, packageWeight: next });
                            }}
                        />

                        {errors.packageWeight && <p className="text-red-400 text-sm">{errors.packageWeight}</p>}

                    </div>

                    {/* Quantity */}
                    <div>
                        <label>Select quantities <span className="text-red-400 ">*</span></label>
                        <div className={`flex justify-between items-center p-0.5 rounded-full border-b-2 ${errors.packageQuantities ? "border-red-500" : "border-[#CDD645]/60"}  bg-[#1e241b] shadow-[inset_0_2px_6px_rgba(0,0,0,0.6),inset_0_-1px_0_rgba(255,255,255,0.08)]`}>
                            <button
                                className="px-4 py-2 rounded-full bg-[#1a1f17] text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.7),inset_0_-1px_0_rgba(255,255,255,0.08)] active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] active:translate-y-px transition"
                                onClick={() =>
                                    setCurrentPackage({
                                        ...currentPackage,
                                        packageQuantities: Math.max(1, currentPackage.packageQuantities - 1),
                                    })
                                }
                            >
                                −
                            </button>

                            <span className="text-white">{currentPackage.packageQuantities}</span>

                            <button
                                className="px-4 py-2 rounded-full bg-[#1a1f17] text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.7),inset_0_-1px_0_rgba(255,255,255,0.08)] active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] active:translate-y-px transition"
                                onClick={() =>
                                    setCurrentPackage({
                                        ...currentPackage,
                                        packageQuantities: Math.min(6, currentPackage.packageQuantities + 1),
                                    })
                                }
                            >
                                +
                            </button>
                        </div>

                        {errors.packageQuantities && <p className="text-red-400 text-sm">{errors.packageQuantities}</p>}
                    </div>

                    {/* Date */}
                    <div className="relative group">
                        {formData.cart.length > 0 && editIndex === null && (
                            <div className="absolute bottom-full mb-3 w-max max-w-xs left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 ease-in-out pointer-events-none group-hover:pointer-events-auto">
                                <div className="relative bg-black/70 border border-amber-500 text-yellow-400 text-sm font-semibold rounded-md py-2 px-4 shadow-lg">
                                    Changing date for this package will change the date for all the packages in your cart.
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-amber-500"></div>
                                </div>
                            </div>
                        )}
                        <label>Pickup Date <span className="text-red-400 ">*</span></label>
                        <CustomDatePicker
                            value={currentPackage.pickUpDate}
                            pickupLocationId={formData.pickupLocationId}
                            dropLocationId={formData.dropLocationId}
                            onChange={handleDateChange}
                            error={!hasDateConflict && datePickerError}
                        />
                        {datePickerError && <p className={`${hasDateConflict ? "mt-1 text-amber-400" : "text-red-400"} text-sm`}>{datePickerError}</p>}
                    </div>
                </div>

                {/* Upload */}
                <div className="flex w-full flex-col lg:w-1/3">
                    <label className="mb-3">
                        Upload package image <span className="text-red-400">*</span>
                    </label>

                    <DropzoneUpload
                        currentPackage={currentPackage}
                        setCurrentPackage={setCurrentPackage}
                        errors={errors}
                        onFileDrop={handleFileDrop}
                        isUploading={isUploadingPackageImage}
                    />
                    {isUploadingPackageImage && (
                        <div className="mt-2 space-y-2">
                            <p className="inline-flex items-center gap-1 text-xs text-[#F6FF6A]">
                                <Icon icon="line-md:loading-loop" className="text-sm" />
                                Uploading image...
                            </p>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#CDD645]/20">
                                <div className="h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-[#CDD645]" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Buttons */}
            <div className="mt-16 flex flex-col justify-end gap-3 sm:flex-row">
                <button
                    onClick={handleClearForm}
                    className="py-3 w-full sm:w-64 hover:bg-[#979646]/40  border rounded-lg border-[#979646] bg-[#979646]/20 font-bold flex gap-2 justify-center items-center text-white/60 cursor-pointer"
                >
                    <Icon icon="mdi:close" /> Clear Form
                </button>

                <button
                    onClick={handleAddToCartClick}
                    disabled={isUploadingPackageImage}
                    className="py-3 w-full sm:w-64 bg-[#CDD645] rounded-lg flex items-center justify-center gap-2 text-black"
                >
                    {editIndex !== null ? (
                        <>
                            <Icon icon="mdi:cart-check" /> Update Cart
                        </>
                    ) : (
                        <>
                            <Icon icon="mdi:cart-plus" /> Drop into Cart
                        </>
                    )}
                </button>
            </div>
            <Cart formData={formData} handleEditPackage={handleEdit} handleDeletePackage={handleDelete} />
            {errors.cart && <p className="text-red-400 text-sm text-end">{errors.cart}</p>}

        </div>
    );
}
