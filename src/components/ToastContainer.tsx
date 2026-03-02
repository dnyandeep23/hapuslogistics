// src/components/ToastContainer.tsx
import React from 'react';
import Toast, { ToastProps } from './Toast';

interface ToastContainerProps {
    toasts: ToastProps[];
    onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
    return (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-md">
            {toasts.map((toast) => (
                <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
            ))}
        </div>
    );
};

export default ToastContainer;
