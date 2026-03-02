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
                className={`border-2 border-dashed rounded-xl h-full flex items-center justify-center cursor-pointer 
        ${isDragActive ? "border-[#CDD645] bg-[#1e241b]/60" : "border-white/40"}
        `}
            >
                <input {...getInputProps()} />

                {previewUrl ? (
                    <div className="relative w-full h-full">
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
                            className="absolute top-2 right-2 bg-black/60 p-1 border rounded-full hover:bg-red-500"
                            disabled={isUploading}
                        >
                            <Icon icon="mdi:delete" className="text-white text-lg" />
                        </button>
                    </div>
                ) : (
                    <span className="text-white/60">
                        {isDragActive ? "Drop image here..." : "Click or drag image here"}
                    </span>
                )}

            </div>

            {errors.packageImage && (
                <p className="text-red-400 text-sm mt-1">{errors.packageImage}</p>
            )}
        </>
    );
}
