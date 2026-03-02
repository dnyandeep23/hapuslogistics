"use client";
import { Icon } from "@iconify/react";
import { Location } from "@/services/logistics";
import CustomSelect from "@/components/CustomSelect";

export default function StepOne({
    formData,
    setFormData,
    errors,
    pickupLocations,
    dropLocations,
    isLoadingPickup,
    isLoadingDrop,
}: {
    formData: { pickupLocationId: string; dropLocationId: string };
    setFormData: (data: any) => void;
    errors: any;
    pickupLocations: Location[];
    dropLocations: Location[];
    isLoadingPickup: boolean;
    isLoadingDrop: boolean;
}) {
    const handlePickupChange = (pickupId: string) => {
        setFormData({ ...formData, pickupLocationId: pickupId, dropLocationId: "" });
    };

    const handleDropChange = (dropId: string) => {
        setFormData({ ...formData, dropLocationId: dropId });
    };

    return (
        <div className="space-y-5">
            <div className="text-[#F6FF6A]">
                <h2 className="text-3xl font-bold ">
                    Select Pickup & Drop location
                </h2>
                <p className="mt-1">Choose where your package will be picked up and delivered</p>
            </div>

            {/* Pickup */}
            <div>
                <div className="flex items-center gap-5 ">
                    <Icon icon="streamline-plump:location-pin-solid" className="text-4xl text-[#e5ff90]" />
                    <div className="w-full">
                        <label className="mb-1.5">Select pickup location <span className="text-red-400"> *</span></label>
                        <CustomSelect
                            value={formData.pickupLocationId}
                            onChange={handlePickupChange}
                            options={pickupLocations}
                            placeholder={isLoadingPickup ? 'Loading...' : 'Select pickup location'}
                            isLoading={isLoadingPickup}
                            error={errors.pickupLocationId}
                        />
                        {errors.pickupLocationId && <p className="text-red-400 text-sm">{errors.pickupLocationId}</p>}
                    </div>
                </div>
            </div>

            {/* Drop */}
            <div>
                <div className="flex items-center gap-5 ">
                    <Icon icon="streamline-plump:location-pin-solid" className="text-4xl text-[#FFA7A7]" />
                    <div className="w-full">
                        <label className="mb-1.5">Select drop location <span className="text-red-400"> *</span></label>
                        <CustomSelect
                            value={formData.dropLocationId}
                            onChange={handleDropChange}
                            options={dropLocations}
                            placeholder={isLoadingDrop ? 'Loading...' : (formData.pickupLocationId ? 'Select drop location' : 'Select a pickup location first')}
                            disabled={!formData.pickupLocationId || isLoadingDrop}
                            isLoading={isLoadingDrop}
                            error={errors.dropLocationId}
                        />
                        {errors.dropLocationId && <p className="text-red-400 text-sm">{errors.dropLocationId}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
