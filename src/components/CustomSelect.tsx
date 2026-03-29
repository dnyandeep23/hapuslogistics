"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { Location } from "@/services/logistics";
import Skeleton from "@/components/Skeleton";

interface CustomSelectProps {
    options: Location[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    disabled?: boolean;
    isLoading?: boolean;
    error?: string;
}

export default function CustomSelect({
    options,
    value,
    onChange,
    placeholder,
    disabled = false,
    isLoading = false,
    error,
}: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find((opt) => opt._id === value);
    const selectedLabel = selectedOption
        ? `${selectedOption.name}, ${selectedOption.city}`
        : value
            ? "Selected location unavailable"
            : placeholder;
    const canRenderPortal = typeof document !== "undefined";

    const handleOptionClick = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // For desktop, close if click is outside the select box.
            // For mobile portal, the backdrop itself handles the close onClick, so we only need this for desktop.
            if (window.innerWidth >= 640 && selectRef.current && !selectRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div className="relative w-full" ref={selectRef}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`package-input min-h-12 md:min-h-16 w-full rounded-xl md:rounded-2xl px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm transition duration-300 ease ${error ? "border-red-500" : "focus:border-[#CDD645]"
                    } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                    }`}
                role="button"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-disabled={disabled}
            >
                <div className="flex min-h-8 md:min-h-10 items-center justify-between gap-3 md:gap-4">
                    {selectedOption ? (
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-[#F6FF6A] text-xs md:text-sm">{selectedOption.name}, {selectedOption.city}</p>
                            <p className="truncate text-[10px] md:text-xs text-white/55 mt-0.5">{selectedOption.address}, {selectedOption.state} {selectedOption.zip}</p>
                        </div>
                    ) : isLoading ? (
                        <div className="w-full space-y-1 pr-6">
                            <Skeleton className="h-3 md:h-4 w-3/4" />
                            <Skeleton className="h-2.5 md:h-3 w-1/2" />
                        </div>
                    ) : (
                        <span className="text-white/42 text-xs md:text-sm">{selectedLabel}</span>
                    )}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5 shrink-0 text-[#f7fac7]" fill="none" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor" >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                    </svg>
                </div>
            </div>

            {isOpen && !disabled && (
                <>
                    {/* Desktop Dropdown */}
                    <div className="hidden lg:block package-panel absolute z-[100] mt-2 max-h-72 w-full overflow-y-auto rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
                        <ul>
                            {isLoading ? (
                                <li className="space-y-2 px-4 py-3">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                    <Skeleton className="h-4 w-2/3" />
                                    <Skeleton className="h-3 w-2/5" />
                                </li>
                            ) : options.length > 0 ? (
                                options.map((option) => (
                                    <li
                                        key={option._id}
                                        onClick={() => handleOptionClick(option._id)}
                                        className="cursor-pointer px-4 py-3 transition bg-[#161700]/90 hover:bg-[#161700]/60"
                                    >
                                        <div>
                                            <p className="font-semibold text-[#F6FF6A]">{option.name}, {option.city}</p>
                                            <p className="text-xs text-white/55">{option.address}, {option.state} {option.zip}</p>
                                        </div>
                                    </li>
                                ))
                            ) : (
                                <li className="px-4 py-4 text-center text-sm text-white/55">
                                    No locations available yet
                                </li>
                            )}
                        </ul>
                    </div>

                    {/* Mobile Bottom Sheet Drawer (Portaled) */}
                    {canRenderPortal && createPortal(
                        <div className="fixed inset-0 z-[100] flex flex-col justify-end lg:hidden pointer-events-auto">
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-modalFadeIn" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} />
                            <div className="relative flex max-h-[75vh] min-h-[50vh] flex-col rounded-t-[2rem] border-t border-white/10 bg-[#141B12] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-modalSlideUp">
                                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-[#141B12] px-5 py-4 rounded-t-[2rem]">
                                    <div>
                                        <h3 className="font-bold text-[#F6FF6A] text-lg">{placeholder}</h3>
                                        <p className="text-xs text-white/50 mt-0.5">Choose an option below</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                                        className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full bg-white/5 text-white/70 transition hover:bg-white/15"
                                    >
                                        <Icon icon="mdi:close" className="text-xl" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto px-2 py-2 mb-safe pb-8">
                                    <ul>
                                        {isLoading ? (
                                            <li className="space-y-2 px-4 py-4">
                                                <Skeleton className="h-4 w-3/4" />
                                                <Skeleton className="h-3 w-1/2" />
                                                <Skeleton className="h-4 w-2/3" />
                                                <Skeleton className="h-3 w-2/5" />
                                            </li>
                                        ) : options.length > 0 ? (
                                            options.map((option) => (
                                                <li
                                                    key={option._id}
                                                    onClick={(e) => { e.stopPropagation(); handleOptionClick(option._id); }}
                                                    className="mb-2 cursor-pointer rounded-2xl px-5 py-4 transition bg-[#D5E400]/5 hover:bg-[#D5E400]/15 active:bg-[#D5E400]/25"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#CDD645]/15 text-[#CDD645]">
                                                            <Icon icon="streamline-plump:location-pin-solid" className="text-lg" />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-[#F6FF6A]">{option.name}, {option.city}</p>
                                                            <p className="text-xs text-white/60">{option.address}, {option.state} {option.zip}</p>
                                                        </div>
                                                    </div>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="px-4 py-6 text-center text-sm text-white/55">
                                                No locations available yet
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                </>
            )}
        </div>
    );
}
