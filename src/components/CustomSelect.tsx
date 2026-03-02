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
                className={`w-full text-[#f7fac7] h-14 text-sm px-4 py-2 border-[#CDD645]/60 rounded-lg transition duration-300 ease focus:outline-none border-b-2 ${error ? "border-red-500" : "border-[#CDD645]/60 focus:border-[#CDD645]"
                    } shadow-sm focus:shadow-md appearance-none  bg-[#1e241b] ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                    }`}
            >
                <div className="flex justify-between items-center">
                    {selectedOption ? (
                        <div>
                            <p className="font-semibold">{selectedOption.name}, {selectedOption.city}</p>
                            <p className="text-xs text-gray-400">{selectedOption.address}, {selectedOption.state} {selectedOption.zip}</p>
                        </div>
                    ) : isLoading ? (
                        <div className="w-full space-y-1 pr-6">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    ) : (
                        <span className="text-gray-400">{placeholder}</span>
                    )}
                    <svg xmlns="http://www.w3.org/2000/svg" className="text-[#f7fac7 h-5 w-5 ml-1 absolute  top-4.5 right-2.5" fill="none" viewBox="0 0 24 24" stroke-width="1.2" stroke="currentColor" >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                    </svg>
                </div>
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-10 w-full mt-1 bg-[#1e241b] border border-[#CDD645]/60 rounded-lg shadow-lg max-h-60 overflow-y-auto">
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
                                    className="px-4 py-2 cursor-pointer hover:bg-[#3E4936]"
                                >
                                    <div>
                                        <p className="font-semibold">{option.name}, {option.city}</p>
                                        <p className="text-xs text-gray-400">{option.address}, {option.state} {option.zip}</p>
                                    </div>
                                </li>
                            ))
                        ) : (
                            <li className="px-4 py-2 text-gray-400">No locations available</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
