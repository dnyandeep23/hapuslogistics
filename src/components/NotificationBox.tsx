// src/components/NotificationBox.tsx
import React, { useState, useEffect } from 'react';

interface NotificationBoxProps {
    message: string;
    type: 'success' | 'warning' | 'error' | '';
    showResend?: boolean;
    onResend?: () => void;
}

const NotificationBox = ({ message, type, showResend = false, onResend }: NotificationBoxProps) => {
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    if (!message || !type) return null;

    const colors = {
        success: 'bg-green-200/20 border-green-500/50 text-green-300',
        warning: 'bg-yellow-200/20 border-yellow-500/50 text-yellow-300',
        error: 'bg-red-200/20 border-red-500/50 text-red-300',
    };

    const handleResendClick = () => {
        if (cooldown === 0 && onResend) {
            onResend();
            setCooldown(2);
        }
    };

    return (
        <div className={`p-4 rounded-lg border ${colors[type]}`} role="alert">
            <div className="flex justify-between items-center">
                <div>
                    <p className="font-bold capitalize">{type}</p>
                    <p className="text-sm whitespace-pre-line">{message}</p>
                </div>
                {showResend && (
                    <button
                        onClick={handleResendClick}
                        disabled={cooldown > 0}
                        className="ml-4 px-3 py-1 text-sm border rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-white/10"
                    >
                        {cooldown > 0 ? `Wait ${cooldown}s` : 'Resend'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default NotificationBox;
