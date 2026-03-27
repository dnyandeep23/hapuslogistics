import { Icon } from "@iconify/react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";

export default function DropzoneUpload({
    currentPackage,
    setCurrentPackage,
    onFileDrop,
    errors,
    isUploading = false,
}: any) {
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
                onFileDrop(file);
            } else {
                // Fallback for existing implementation if onFileDrop is not provided
                setCurrentPackage({
                    ...currentPackage,
                    packageImage: file,
                });
            }
        },
    });

    const getPreviewUrl = () => {
        if (!currentPackage.packageImage) return null;
        if (typeof currentPackage.packageImage === 'string') {
            return currentPackage.packageImage;
        }
        // It's a File object
        if (currentPackage.packageImage instanceof File) {
            return URL.createObjectURL(currentPackage.packageImage);
        }
        return null;
    }

    const previewUrl = getPreviewUrl();


    return (
        <>
            <div
                {...getRootProps()}
                className={`package-panel-soft min-h-[180px] md:min-h-[220px] rounded-[1.3rem] sm:rounded-[1.5rem] border-2 border-dashed p-2.5 sm:p-3 transition
        ${isDragActive ? "border-[#CDD645] bg-[#d5e400]/10" : "border-white/18"}
        `}
            >
                <input {...getInputProps()} />

                {previewUrl ? (
                    <div className="relative h-[180px] sm:h-[260px] w-full overflow-hidden rounded-[1.1rem]">
                        <Image
                            src={previewUrl}
                            alt="Package Preview"
                            fill
                            className="object-cover rounded-xl"
                           
                        />

                        {/* Delete button */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation(); // prevent opening file dialog
                                setCurrentPackage({
                                    ...currentPackage,
                                    packageImage: "",
                                });
                            }}
                            className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/55 p-2 transition hover:bg-red-500"
                            disabled={isUploading}
                        >
                            <Icon icon="mdi:delete" className="text-white text-lg" />
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 px-3 py-6 sm:px-4 sm:py-8 text-center">
                        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-[#d5e400]/14 text-[#F6FF6A]">
                            <Icon icon="solar:gallery-add-bold-duotone" className="text-[1.5rem] sm:text-[1.8rem]" />
                        </div>
                        <div>
                            <p className="text-[13px] sm:text-sm font-semibold text-[#F6FF6A]">
                                {isDragActive ? "Drop image here" : "Upload package image"}
                            </p>
                            <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-sm text-white/60">
                                Tap to browse or drag and drop on desktop.
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
