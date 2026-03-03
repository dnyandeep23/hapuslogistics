import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";
import DropzoneUpload from "../../components/DropzoneUpload";
import Cart from "../../components/cart";
import CustomDatePicker from "@/components/CustomDatePicker";
import {
  DEFAULT_PACKAGE_CATEGORIES,
  DEFAULT_PACKAGE_SIZES,
  type PackageCategoryConfig,
  type PackageSizeConfig,
} from "@/lib/packageCatalog";

type PackageTypeOption = {
  id: string;
  label: string;
  icon: string;
};

type PackageSizeOption = {
  label: string;
  desc: string;
  scale: number;
};

const getScaleByIndex = (index: number, total: number) => {
  const safeTotal = Math.max(1, total);
  if (safeTotal === 1) return 1;
  const minScale = 0.8;
  const maxScale = 1.5;
  const step = (maxScale - minScale) / (safeTotal - 1);
  return Number((minScale + step * index).toFixed(2));
};

const fallbackPackageTypes: PackageTypeOption[] = [
  ...DEFAULT_PACKAGE_CATEGORIES.map((entry, index) => ({
    id: `${entry.name.toLowerCase().replace(/\s+/g, "-")}-${index}`,
    label: entry.name,
    icon: entry.icon || "mdi:shape-outline",
  })),
];

const fallbackPackageSizes: PackageSizeOption[] = [
  ...DEFAULT_PACKAGE_SIZES.map((entry) => ({
    label: entry.name,
    desc: entry.description,
    scale: entry.visualScale,
  })),
];

const normalizeCategoryName = (value: unknown) => String(value ?? "").trim().toLowerCase();
const OTHER_CATEGORY_NAME = "other";

export function PackageSizeSelector({
  currentPackage,
  setCurrentPackage,
  packageSizes,
}: {
  currentPackage: Record<string, unknown>;
  setCurrentPackage: (next: Record<string, unknown>) => void;
  packageSizes: PackageSizeOption[];
}) {
  const safePackageSizes = packageSizes.length > 0 ? packageSizes : fallbackPackageSizes;
  const startingIndex = Math.max(
    0,
    safePackageSizes.findIndex((size) => size.label === currentPackage.packageSize),
  );

  const [index, setIndex] = useState(startingIndex);
  const [direction, setDirection] = useState<"left" | "right">("right");

  useEffect(() => {
    const matchingIndex = safePackageSizes.findIndex((size) => size.label === currentPackage.packageSize);
    if (matchingIndex >= 0) {
      setIndex(matchingIndex);
      return;
    }

    if (safePackageSizes.length > 0) {
      setIndex(0);
      setCurrentPackage({
        ...currentPackage,
        packageSize: safePackageSizes[0].label,
      });
    }
  }, [currentPackage, safePackageSizes, setCurrentPackage]);

  const handleNext = () => {
    if (safePackageSizes.length === 0) return;
    setDirection("right");
    const next = (index + 1) % safePackageSizes.length;
    setIndex(next);
    setCurrentPackage({
      ...currentPackage,
      packageSize: safePackageSizes[next].label,
    });
  };

  const handlePrev = () => {
    if (safePackageSizes.length === 0) return;
    setDirection("left");
    const prev = (index - 1 + safePackageSizes.length) % safePackageSizes.length;
    setIndex(prev);
    setCurrentPackage({
      ...currentPackage,
      packageSize: safePackageSizes[prev].label,
    });
  };

  return (
    <div className="flex w-full flex-col items-start overflow-hidden lg:w-1/3">
      <label className="mb-3">
        Select package size <span className="text-red-400">*</span>
      </label>

      <div className="flex w-full items-center justify-center gap-6 sm:gap-12">
        <button onClick={handlePrev} className="h-10 w-10 rounded-full bg-[#1e241b]">
          ◀
        </button>

        <Icon
          icon="noto:package"
          className="h-44 text-[#d2a679] transition-transform duration-1000"
          style={{
            fontSize: "120px",
            transform: `scale(${safePackageSizes[index]?.scale ?? 1})`,
          }}
        />

        <button onClick={handleNext} className="h-10 w-10 rounded-full bg-[#1e241b]">
          ▶
        </button>
      </div>

      <div className="relative mt-4 h-16 w-full overflow-hidden rounded-lg bg-black/50 text-center">
        <div
          key={index}
          className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700
          ${direction === "right" ? "animate-slideInRight" : "animate-slideInLeft"}`}
        >
          <p className="font-semibold">{safePackageSizes[index]?.label ?? "--"}</p>
          <p className="text-sm text-white/60">{safePackageSizes[index]?.desc ?? "--"}</p>
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
  packageCategories,
  packageSizes,
}: any) {
  const safePackageTypes: PackageTypeOption[] =
    Array.isArray(packageCategories) && packageCategories.length > 0
      ? packageCategories.map((entry: PackageCategoryConfig, index: number) => ({
          id: `${entry.name}-${index}`,
          label: entry.name,
          icon: entry.icon || "mdi:shape-outline",
        }))
      : fallbackPackageTypes;

  const safePackageSizes: PackageSizeOption[] =
    Array.isArray(packageSizes) && packageSizes.length > 0
      ? packageSizes.map((entry: PackageSizeConfig, index: number) => ({
          label: entry.name,
          desc: entry.description || `Max ${entry.maxWeightKg} kg`,
          // Use size order from API to keep scaling consistent for newly added sizes.
          scale: getScaleByIndex(index, packageSizes.length),
        }))
      : fallbackPackageSizes;

  const hasOtherCategory = useMemo(
    () => safePackageTypes.some((entry) => normalizeCategoryName(entry.label) === OTHER_CATEGORY_NAME),
    [safePackageTypes],
  );
  const isOtherCategorySelected =
    hasOtherCategory && normalizeCategoryName(currentPackage.packageType) === OTHER_CATEGORY_NAME;

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

  const datePickerError =
    errors.pickUpDate ||
    (hasDateConflict ? "Changing this date will update the date for all packages in the cart." : undefined);

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

      <div className="flex flex-col">
        <label className="mb-2">Package Name (optional)</label>
        <input
          placeholder="Package Name"
          className="rounded-lg border-b-2 border-[#CDD645]/60 bg-[#1e241b] px-4 pb-2 pt-4 focus:border-[#CDD645]"
          value={currentPackage.packageName}
          onChange={(e) => setCurrentPackage({ ...currentPackage, packageName: e.target.value })}
        />
        {errors.packageName && <p className="text-sm text-red-400">{errors.packageName}</p>}
      </div>

      <div className="flex flex-col">
        <label className="mb-2">
          Select package type <span className="text-red-400">*</span>
        </label>

        <div className="flex flex-wrap gap-3">
          {safePackageTypes.map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              onClick={() => setCurrentPackage({ ...currentPackage, packageType: pkg.label })}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2
              ${
                currentPackage.packageType === pkg.label
                  ? "bg-[#F6FF6A] text-black"
                  : "border-white/20 bg-[#1e241b]"
              }`}
            >
              <Icon icon={pkg.icon} className="text-xl" />
              {pkg.label}
            </button>
          ))}
        </div>
        {errors.packageType && <p className="text-sm text-red-400">{errors.packageType}</p>}
      </div>

      {isOtherCategorySelected && (
        <div className="mt-4 flex flex-col">
          <label>Specify (Other type)</label>
          <input
            className="rounded-lg border-b-2 border-[#CDD645]/60 bg-[#1e241b] px-4 pb-2 pt-4"
            value={currentPackage.otherPackageType}
            onChange={(e) =>
              setCurrentPackage({
                ...currentPackage,
                otherPackageType: e.target.value,
              })
            }
          />
          {errors.otherPackageType && <p className="text-sm text-red-400">{errors.otherPackageType}</p>}

          <div className="mt-3 rounded-lg border border-amber-400/45 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <p className="flex items-start gap-2">
              <Icon icon="solar:danger-triangle-linear" className="mt-0.5 text-base" />
              <span>
                Pickup pricing for <strong>Other</strong> category may be charged higher if applicable.
                Please request a call booking for an exact quote.
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-6 lg:flex-row">
        <PackageSizeSelector
          currentPackage={currentPackage}
          setCurrentPackage={setCurrentPackage}
          packageSizes={safePackageSizes}
        />

        <div className="flex w-full flex-col gap-5 lg:w-1/3">
          <div>
            <label>
              Enter weight <span className="text-red-400 ">*</span>
            </label>
            <input
              type="number"
              min={0}
              max={100}
              className={`${errors.packageWeight ? "border-red-500" : "border-[#CDD645]/60"} w-full rounded-xl border-b-2 bg-[#1e241b] px-4 py-3`}
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

            {errors.packageWeight && <p className="text-sm text-red-400">{errors.packageWeight}</p>}
          </div>

          <div>
            <label>
              Select quantities <span className="text-red-400 ">*</span>
            </label>
            <div
              className={`flex items-center justify-between rounded-full border-b-2 p-0.5 ${
                errors.packageQuantities ? "border-red-500" : "border-[#CDD645]/60"
              }  bg-[#1e241b] shadow-[inset_0_2px_6px_rgba(0,0,0,0.6),inset_0_-1px_0_rgba(255,255,255,0.08)]`}
            >
              <button
                className="rounded-full bg-[#1a1f17] px-4 py-2 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.7),inset_0_-1px_0_rgba(255,255,255,0.08)] transition active:translate-y-px active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]"
                onClick={() =>
                  setCurrentPackage({
                    ...currentPackage,
                    packageQuantities: Math.max(1, currentPackage.packageQuantities - 1),
                  })
                }
              >
                -
              </button>

              <span className="text-white">{currentPackage.packageQuantities}</span>

              <button
                className="rounded-full bg-[#1a1f17] px-4 py-2 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.7),inset_0_-1px_0_rgba(255,255,255,0.08)] transition active:translate-y-px active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]"
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

            {errors.packageQuantities && <p className="text-sm text-red-400">{errors.packageQuantities}</p>}
          </div>

          <div className="group relative">
            {formData.cart.length > 0 && editIndex === null && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-3 w-max max-w-xs -translate-x-1/2 scale-95 opacity-0 transition-all duration-150 ease-in-out group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100">
                <div className="relative rounded-md border border-amber-500 bg-black/70 px-4 py-2 text-sm font-semibold text-yellow-400 shadow-lg">
                  Changing date for this package will change the date for all the packages in your cart.
                  <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-amber-500"></div>
                </div>
              </div>
            )}
            <label>
              Pickup Date <span className="text-red-400 ">*</span>
            </label>
            <CustomDatePicker
              value={currentPackage.pickUpDate}
              pickupLocationId={formData.pickupLocationId}
              dropLocationId={formData.dropLocationId}
              onChange={handleDateChange}
              error={!hasDateConflict && datePickerError}
            />
            {datePickerError && (
              <p className={`${hasDateConflict ? "mt-1 text-amber-400" : "text-red-400"} text-sm`}>
                {datePickerError}
              </p>
            )}
          </div>
        </div>

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

      <div className="mt-16 flex flex-col justify-end gap-3 sm:flex-row">
        <button
          onClick={handleClearForm}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#979646] bg-[#979646]/20 py-3 font-bold text-white/60 hover:bg-[#979646]/40 sm:w-64"
        >
          <Icon icon="mdi:close" /> Clear Form
        </button>

        <button
          onClick={handleAddToCartClick}
          disabled={isUploadingPackageImage}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#CDD645] py-3 text-black sm:w-64"
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
      {errors.cart && <p className="text-end text-sm text-red-400">{errors.cart}</p>}
    </div>
  );
}
