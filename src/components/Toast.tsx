// src/components/Toast.tsx
import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';

export interface ToastProps {
    id: string;
    message: string;
    type?: ToastType;
    onDismiss: (id: string) => void;
    duration?: number;
    showProgress?: boolean;
    showIcon?: boolean;
    showCloseButton?: boolean;
    pauseOnHover?: boolean;
    icon?: string;
    className?: string;
}

const ICONS: Record<ToastType, string> = {
    success: 'line-md:confirm-circle',
    error: 'line-md:close-circle',
    warning: 'line-md:alert-circle',
    info: 'line-md:alert',
};

const BACKGROUNDS: Record<ToastType, string> = {
    success:
        "bg-gradient-to-r from-[#2A3125]/90 via-[#344033]/80 to-[#2A3125]/90 backdrop-blur-md",
    error:
        "bg-gradient-to-r from-[#2A3125]/90 via-[#402D2D]/80 to-[#2A3125]/90 backdrop-blur-md",
    warning:
        "bg-gradient-to-r from-[#2A3125]/90 via-[#403E2D]/80 to-[#2A3125]/90 backdrop-blur-md",
    info:
        "bg-gradient-to-r from-[#2A3125]/70 via-[#2F3A33]/70 to-[#2A3125]/70 backdrop-blur-md",
};


const ICON_COLORS: Record<ToastType, string> = {
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-amber-400',
    info: 'text-blue-400',
};

const Toast: React.FC<ToastProps> = ({
    id,
    message,
    type = 'info',
    onDismiss,
    duration = 5000,
    showProgress = true,
    showIcon = true,
    showCloseButton = true,
    pauseOnHover = true,
    icon,
    className = '',
}) => {
    const [exiting, setExiting] = useState(false);
    const [progress, setProgress] = useState(100);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (isPaused || !showProgress) return;

        const interval = 16;
        const decrement = (interval / duration) * 100;

        const progressTimer = setInterval(() => {
            setProgress((prev) => {
                const newProgress = prev - decrement;
                if (newProgress <= 0) {
                    clearInterval(progressTimer);
                    return 0;
                }
                return newProgress;
            });
        }, interval);

        const dismissTimer = setTimeout(() => {
            setExiting(true);
            setTimeout(() => onDismiss(id), 100);
        }, duration);

        return () => {
            clearInterval(progressTimer);
            clearTimeout(dismissTimer);
        };
    }, [id, duration, onDismiss, isPaused, showProgress]);

    const handleDismiss = () => {
        setExiting(true);
        setTimeout(() => onDismiss(id), 300);
    };

    const handleMouseEnter = () => {
        if (pauseOnHover) {
            setIsPaused(true);
        }
    };

    const handleMouseLeave = () => {
        if (pauseOnHover) {
            setIsPaused(false);
        }
    };

    return (
        <div
            className={`
                cursor
                relative flex items-center p-4 mb-3 rounded-md shadow-lg text-white overflow-hidden
                ${BACKGROUNDS[type]}
                transition-all duration-300 ease-in-out
                ${exiting ? 'opacity-0 -translate-y-5' : 'opacity-100 translate-y-0'}
                ${className}
            `}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {showIcon && (
                <Icon icon={icon || ICONS[type]} className={`w-6 h-6 mr-3 shrink-0 ${ICON_COLORS[type]}`} />
            )}
            <p className="text-sm font-medium flex-1 text-gray-100">{message}</p>
            {showCloseButton && (
                <button
                    onClick={handleDismiss}
                    className="ml-4 p-1 rounded-full cursor-pointer hover:bg-white/10 transition-colors shrink-0 text-gray-400 hover:text-white"
                    aria-label="Close notification"
                >
                    <Icon icon="line-md:close-small" className="w-5 h-5" />
                </button>
            )}

            {/* Progress bar */}
            {showProgress && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                    <div
                        className={`h-full transition-all duration-100 ease-linear ${type === 'success' ? 'bg-green-500' :
                            type === 'error' ? 'bg-red-500' :
                                type === 'warning' ? 'bg-amber-500' :
                                    'bg-blue-500'
                            }`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
        </div>
    );
};

export default Toast;