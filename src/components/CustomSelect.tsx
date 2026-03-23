"use client";
import { useState, useRef, useEffect } from "react";
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

    const handleOptionClick = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
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
                className={`package-input min-h-16 w-full rounded-2xl px-4 py-3 text-sm transition duration-300 ease ${error ? "border-red-500" : "focus:border-[#CDD645]"
                    } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                    }`}
            >
                <div className="flex min-h-10 items-center justify-between gap-4">
                    {selectedOption ? (
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-[#F6FF6A]">{selectedOption.name}, {selectedOption.city}</p>
                            <p className="truncate text-xs text-white/55">{selectedOption.address}, {selectedOption.state} {selectedOption.zip}</p>
                        </div>
                    ) : isLoading ? (
                        <div className="w-full space-y-1 pr-6">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    ) : (
                        <span className="text-white/42">{placeholder}</span>
                    )}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-[#f7fac7]" fill="none" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor" >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                    </svg>
                </div>
            </div>

            {isOpen && !disabled && (
                <div className="package-panel absolute z-10 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl shadow-lg">
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
                            <li className="px-4 py-3 text-white/55">No locations available</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
