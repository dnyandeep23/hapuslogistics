"use client";

import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";
import LoadingScreen from "@/components/LoadingScreen";
import AdminBusForm from "@/components/admin/AdminBusForm";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { fetchUser } from "@/lib/redux/userSlice";
import { formatIndiaPhoneInput, normalizeIndiaPhone } from "@/lib/phone";

const shellButtonClass =
    "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white";
const primaryActionClass =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D5E400] to-[#E4E67A] px-6 py-3 text-sm font-bold text-black shadow-lg transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";

export default function AddBusPage() {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const { addToast } = useToast();
    const { user, loading } = useAppSelector((state) => state.user);
    const isAdmin = user?.role === "admin";
    const [requiredPhoneDraft, setRequiredPhoneDraft] = useState("");
    const [requiredPhoneError, setRequiredPhoneError] = useState("");
    const [savingRequiredPhone, setSavingRequiredPhone] = useState(false);
    const requiresAdminPhone = isAdmin && !normalizeIndiaPhone(user?.phone);

    useEffect(() => {
        // After the initial load, if there's no user, redirect to login.
        if (!loading && !isAdmin) {
            addToast("You are not authorized to view this page.", "error");
            router.push('/dashboard');
        }
    }, [user, loading, router, addToast, isAdmin]);

    useEffect(() => {
        if (!requiresAdminPhone) return;
        setRequiredPhoneDraft(formatIndiaPhoneInput(""));
        setRequiredPhoneError("");
    }, [requiresAdminPhone]);

    const saveRequiredPhone = async () => {
        const phone = normalizeIndiaPhone(requiredPhoneDraft);
        if (phone === "") {
            setRequiredPhoneError("Contact number is required.");
            return;
        }
        if (phone === null) {
            setRequiredPhoneError("Enter a valid Indian mobile number.");
            return;
        }

        try {
            setSavingRequiredPhone(true);
            setRequiredPhoneError("");
            const response = await fetch("/api/auth/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone }),
            });
            const data = await response.json();
            if (!response.ok) {
                setRequiredPhoneError(data?.message || "Failed to save contact number.");
                return;
            }
            await dispatch(fetchUser());
            addToast("Contact number saved successfully.", "success");
        } catch (error: unknown) {
            setRequiredPhoneError(error instanceof Error ? error.message : "Failed to save contact number.");
        } finally {
            setSavingRequiredPhone(false);
        }
    };


    if (loading) return <LoadingScreen />;
    if (!isAdmin) return null;


    return (
        <section className="relative w-full max-w-7xl mx-auto space-y-6">

                {requiresAdminPhone ? (
                    <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#141A14] p-5 shadow-2xl backdrop-blur-xl sm:p-8">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-2xl">
                                <div className="inline-flex items-center gap-2 rounded-full border border-[#D5E400]/20 bg-[#D5E400]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#D5E400]">
                                    <Icon icon="solar:phone-calling-rounded-bold-duotone" className="text-base" />
                                    Initial Setup
                                </div>
                                <h2 className="mt-4 text-2xl font-bold text-[#E4E67A]">
                                    Add your contact number
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-white/50">
                                    Your admin contact number is required before the first bus is created. It becomes the main support number connected to your company flow.
                                </p>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/40">
                                <Icon icon="solar:lock-password-bold-duotone" className="text-base text-white/30" />
                                Step 2 unlocks after save
                            </div>
                        </div>

                        <div className="mt-8 rounded-2xl border border-white/5 bg-[#1A221A] p-5 lg:p-6">
                            <label className="block text-sm font-medium text-white/80">
                                Admin contact number
                                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                                    <input
                                        type="tel"
                                        value={requiredPhoneDraft}
                                        onChange={(event) => setRequiredPhoneDraft(formatIndiaPhoneInput(event.target.value))}
                                        placeholder="+91 9876543210"
                                        className="dashboard-input w-full rounded-xl bg-black/40 px-4 py-3 text-sm transition border border-white/10 focus:border-[#D5E400]/50 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={saveRequiredPhone}
                                        disabled={savingRequiredPhone}
                                        className={primaryActionClass}
                                    >
                                        <Icon icon={savingRequiredPhone ? "line-md:loading-loop" : "solar:check-circle-bold-duotone"} className="text-base" />
                                        {savingRequiredPhone ? "Saving..." : "Save Contact Number"}
                                    </button>
                                </div>
                            </label>

                            {requiredPhoneError ? (
                                <p className="mt-3 text-sm text-red-300">{requiredPhoneError}</p>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {!requiresAdminPhone ? (
                    <AdminBusForm
                        mode="create"
                        cancelHref="/dashboard/buses"
                        successHref="/dashboard/buses"
                    />
                ) : null}
            </section>
    );
}
