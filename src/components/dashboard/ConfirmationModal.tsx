"use client";

import React from "react";
import Modal from "@/components/dashboard/Modal";

type ConfirmationVariant = "danger" | "warning" | "primary" | "success";

type ConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  children?: React.ReactNode;
  isLoading?: boolean;
  disableClose?: boolean;
  hideCancel?: boolean;
  confirmVariant?: ConfirmationVariant;
};

const confirmVariantClasses: Record<ConfirmationVariant, string> = {
  danger:
    "border-rose-400/50 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
  warning:
    "border-amber-400/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20",
  primary:
    "border-[#D5E400]/60 bg-[#D5E400]/10 text-[#E4E67A] hover:bg-[#D5E400]/20",
  success:
    "border-emerald-400/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
};

export default function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
  children,
  isLoading = false,
  disableClose = false,
  hideCancel = false,
  confirmVariant = "danger",
}: ConfirmationModalProps) {
  const handleClose = () => {
    if (disableClose || isLoading) return;
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={handleClose}
    >
      <div className="space-y-4">
        {description ? (
          <div className="text-sm text-white/80">{description}</div>
        ) : null}
        {children}
        <div className="flex flex-wrap justify-end gap-3">
          {!hideCancel ? (
            <button
              type="button"
              onClick={handleClose}
              disabled={disableClose || isLoading}
              className="dashboard-surface-soft rounded-full px-4 py-2 text-sm text-white/75 transition hover:bg-white/10 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${confirmVariantClasses[confirmVariant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
