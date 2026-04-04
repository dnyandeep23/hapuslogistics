"use client";

import { Icon } from "@iconify/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import type { PackageDraft } from "@/app/package/types";

export default function DropzoneUpload({
    currentPackage,
    setCurrentPackage,
    onFileDrop,
    onRemoveImage,
    errors,
    isUploading = false,
}: {
    currentPackage: PackageDraft;
    setCurrentPackage: (next: PackageDraft) => void;
    onFileDrop?: (file: File) => void;
    onRemoveImage?: () => void;
    errors: Record<string, string>;
    isUploading?: boolean;
}) {
    const { isMobile, isTablet } = useResponsiveMode();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: {
            "image/*": [],
        },
        disabled: isUploading,
        multiple: false,
        onDrop: (acceptedFiles: File[]) => {
            const file = acceptedFiles[0];
            if (!file) return;

            if (onFileDrop) {
                setPreviewUrl(null);
                onFileDrop(file);
            } else {
                const objectUrl = URL.createObjectURL(file);
                setPreviewUrl(objectUrl);
                // Fallback for existing implementation if onFileDrop is not provided
                setCurrentPackage({
                    ...currentPackage,
                    packageImage: file,
                });
            }
        },
    });

    useEffect(() => {
        return () => {
            if (previewUrl?.startsWith("blob:")) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);
    const resolvedPreviewUrl =
        typeof currentPackage.packageImage === "string"
            ? currentPackage.packageImage
            : previewUrl;


    return (
        <>
            <div
                {...getRootProps()}
                className={`package-panel-soft min-h-[180px] md:min-h-[220px] rounded-[1.3rem] sm:rounded-[1.5rem] border-2 border-dashed p-2.5 sm:p-3 transition
        ${isDragActive ? "border-[#CDD645] bg-[#d5e400]/10" : "border-white/18"}
        `}
            >
                <input {...getInputProps()} />

                {resolvedPreviewUrl ? (
                    <div className={`relative w-full overflow-hidden rounded-[1.1rem] ${isMobile ? "h-[180px]" : isTablet ? "h-[220px]" : "h-[260px]"}`}>
                        <Image
                            src={resolvedPreviewUrl}
                            alt="Package Preview"
                            fill
                            className="object-cover rounded-xl"
                           
                        />

                        {/* Delete button */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation(); // prevent opening file dialog
                                if (previewUrl?.startsWith("blob:")) {
                                    URL.revokeObjectURL(previewUrl);
                                }
                                setPreviewUrl(null);
                                if (onRemoveImage) {
                                    onRemoveImage();
                                } else {
                                    setCurrentPackage({
                                        ...currentPackage,
                                        packageImage: "",
                                    });
                                }
                            }}
                            className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/55 p-2 transition hover:bg-red-500"
                            disabled={isUploading}
                        >
                            <Icon icon="mdi:delete" className="text-white text-lg" />
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 px-3 py-6 sm:px-4 sm:py-8 text-center">
                        <div className={`flex items-center justify-center rounded-2xl bg-[#d5e400]/14 text-[#F6FF6A] ${isMobile ? "h-11 w-11" : "h-12 w-12 sm:h-14 sm:w-14"}`}>
                            <Icon icon="solar:gallery-add-bold-duotone" className={isMobile ? "text-[1.35rem]" : "text-[1.5rem] sm:text-[1.8rem]"} />
                        </div>
                        <div>
                            <p className={`font-semibold text-[#F6FF6A] ${isMobile ? "text-sm" : "text-[13px] sm:text-sm"}`}>
                                {isDragActive ? "Drop image here" : "Upload package image"}
                            </p>
                            <p className={`mt-0.5 sm:mt-1 text-white/60 ${isMobile ? "text-[11px]" : "text-[11px] sm:text-sm"}`}>
                                {isMobile ? "Tap to browse." : "Tap to browse or drag and drop on desktop."}
                            </p>
                        </div>
                    </div>
                )}

            </div>

            {errors.packageImage && (
                <p className="text-red-400 text-sm mt-1">{errors.packageImage}</p>
            )}
        </>
    );
}
