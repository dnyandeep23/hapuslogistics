"use client";
import { Icon } from "@iconify/react";
import { Location } from "@/services/logistics";
import CustomSelect from "@/components/CustomSelect";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type StepOneFormData = {
    pickupLocationId: string;
    dropLocationId: string;
};

type StepOneErrors = Record<string, string>;

export default function StepOne({
    formData,
    setFormData,
    errors,
    pickupLocations,
    dropLocations,
    isLoadingPickup,
    isLoadingDrop,
}: {
    formData: StepOneFormData;
    setFormData: (data: StepOneFormData) => void;
    errors: StepOneErrors;
    pickupLocations: Location[];
    dropLocations: Location[];
    isLoadingPickup: boolean;
    isLoadingDrop: boolean;
}) {
    const { isMobile, isTablet, isDesktop } = useResponsiveMode();
    const { t } = useTranslation();

    const handlePickupChange = (pickupId: string) => {
        setFormData({ ...formData, pickupLocationId: pickupId, dropLocationId: "" });
    };

    const handleDropChange = (dropId: string) => {
        setFormData({ ...formData, dropLocationId: dropId });
    };

    return (
        <div className="space-y-5 sm:space-y-8">
            <div className="max-w-2xl text-[#F6FF6A]">
                <h2 className="text-xl sm:text-3xl font-bold">
                    {isMobile ? t.package.stepOne.mobileTitle : t.package.stepOne.desktopTitle}
                </h2>
                <p className="mt-1.5 sm:mt-2 text-[13px] leading-5 text-white/68 sm:text-base sm:leading-6">
                    {isMobile
                        ? t.package.stepOne.mobileDesc
                        : isTablet
                            ? t.package.stepOne.tabletDesc
                            : t.package.stepOne.desktopDesc}
                </p>
            </div>

            <div className="grid gap-3 lg:gap-4 lg:grid-cols-2">
                <div className="package-panel relative z-50 rounded-[1.4rem] md:rounded-[1.6rem] p-3.5 sm:p-5">
                    <div className="mb-3 sm:mb-4 flex items-start gap-2 md:gap-4">
                        <div className="flex md:h-12 h-8 md:w-12 w-8 shrink-0 items-center justify-center rounded-2xl bg-[#d5e400]/14 text-[#F6FF6A]">
                            <Icon icon="streamline-plump:location-pin-solid" className="md:text-2xl text-xl" />
                        </div>
                        <div className="min-w-0 w-full">
                            <label className="mb-1.5 sm:mb-2 block text-[13px] sm:text-sm font-medium text-white/85">
                                {t.package.stepOne.pickupLabel} <span className="text-red-400"> *</span>
                            </label>
                            <p className="mb-2 sm:mb-3 text-[11px] sm:text-xs leading-[1.3] sm:leading-normal text-white/55">{t.package.stepOne.pickupDesc}</p>
                            <CustomSelect
                                value={formData.pickupLocationId}
                                onChange={handlePickupChange}
                                options={pickupLocations}
                                placeholder={isLoadingPickup ? 'Loading...' : t.package.stepOne.pickupPlaceholder}
                                isLoading={isLoadingPickup}
                                error={errors.pickupLocationId}
                            />
                            {errors.pickupLocationId && <p className="mt-2 text-sm text-red-400">{errors.pickupLocationId}</p>}
                        </div>
                    </div>
                </div>

                <div className="package-panel relative rounded-[1.4rem] md:rounded-[1.6rem] z-40 p-3.5 sm:p-5">
                    <div className="mb-3 sm:mb-4 flex items-start gap-2 md:gap-4">
                        <div className="flex md:h-12 h-8 md:w-12 w-8 shrink-0 items-center justify-center rounded-2xl bg-[#ff8e8e]/12 text-[#ffb3b3]">
                            <Icon icon="streamline-plump:location-pin-solid" className="md:text-2xl text-xl" />
                        </div>
                        <div className="min-w-0 w-full">
                            <label className="mb-1.5 sm:mb-2 block text-[13px] sm:text-sm font-medium text-white/85">
                                {t.package.stepOne.dropLabel} <span className="text-red-400"> *</span>
                            </label>
                            <p className="mb-2 sm:mb-3 text-[11px] sm:text-xs leading-[1.3] sm:leading-normal text-white/55">{t.package.stepOne.dropDesc}</p>
                            <CustomSelect

                                value={formData.dropLocationId}
                                onChange={handleDropChange}
                                options={dropLocations}
                                placeholder={isLoadingDrop ? 'Loading...' : (formData.pickupLocationId ? t.package.stepOne.dropPlaceholder : t.package.stepOne.dropPlaceholderDisabled)}
                                disabled={!formData.pickupLocationId || isLoadingDrop}
                                isLoading={isLoadingDrop}
                                error={errors.dropLocationId}
                            />
                            {errors.dropLocationId && <p className="mt-2 text-sm text-red-400">{errors.dropLocationId}</p>}
                        </div>
                    </div>
                </div>
            </div>

            <div className={`package-panel-soft grid gap-3 sm:gap-4 rounded-[1.4rem] md:rounded-[1.6rem] p-3.5 text-[13px] sm:text-sm text-white/68 sm:p-5 ${isDesktop ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                <div>
                    <p className="font-semibold text-[#F6FF6A]">{t.package.stepOne.pickupFirst}</p>
                    <p className="mt-0.5 sm:mt-1 leading-5 sm:leading-normal">{t.package.stepOne.pickupFirstDesc}</p>
                </div>
                <div>
                    <p className="font-semibold text-[#F6FF6A]">{isMobile ? t.package.stepOne.responsiveTitleMobile : isTablet ? t.package.stepOne.responsiveTitleTablet : t.package.stepOne.responsiveTitleDesktop}</p>
                    <p className="mt-0.5 sm:mt-1 leading-5 sm:leading-normal">
                        {isMobile
                            ? t.package.stepOne.responsiveDescMobile
                            : isTablet
                                ? t.package.stepOne.responsiveDescTablet
                                : t.package.stepOne.responsiveDescDesktop}
                    </p>
                </div>
                {isDesktop ? (
                    <div>
                        <p className="font-semibold text-[#F6FF6A]">{t.package.stepOne.nextStep}</p>
                        <p className="mt-0.5 sm:mt-1 leading-5 sm:leading-normal">{t.package.stepOne.nextStepDesc}</p>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
