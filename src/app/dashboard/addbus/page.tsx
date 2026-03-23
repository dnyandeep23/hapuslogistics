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
    "inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/82 transition hover:bg-white/10 hover:text-white";
const primaryActionClass =
    "inline-flex items-center justify-center gap-2 rounded-full border border-[#d5e400]/25 bg-[#d5e400]/12 px-5 py-3 text-sm font-semibold text-[#F2FF8F] transition hover:bg-[#d5e400]/18 disabled:opacity-60";

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
        <section className="relative px-1 pb-12 pt-2 sm:px-2">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-12 top-0 h-56 w-56 rounded-full bg-[#d5e400]/8 blur-3xl" />
                <div className="absolute right-0 top-20 h-64 w-64 rounded-full bg-emerald-300/6 blur-3xl" />
            </div>

            <div className="relative mx-auto w-full max-w-7xl space-y-6">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className={shellButtonClass}
                >
                    <Icon icon="solar:arrow-left-outline" className="text-base" />
                    Back
                </button>

                <div className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(245,246,238,0.09),rgba(18,24,14,0.12),rgba(14,19,11,0.16))] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:p-6">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#D5E400]/25 bg-[#D5E400]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F4F8BF]">
                        <Icon icon="solar:bus-line-duotone" className="text-base" />
                        Fleet setup
                    </div>
                    <h1 className="mt-3 text-2xl font-bold text-[#F4F8BF] sm:text-3xl">Add New Bus</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
                        Configure bus details, route flow, pricing and media in one guided setup.
                    </p>
                </div>

                {requiresAdminPhone ? (
                    <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(245,246,238,0.1),rgba(18,24,14,0.16),rgba(14,19,11,0.2))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-6">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-2xl">
                                <div className="inline-flex items-center gap-2 rounded-full border border-[#d5e400]/20 bg-[#d5e400]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F2FF8F]">
                                    <Icon icon="solar:phone-calling-rounded-bold-duotone" className="text-base" />
                                    Step 1 of 2
                                </div>
                                <h2 className="mt-4 text-2xl font-semibold text-[#F6FF6A]">
                                    Add contact number first
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-white/72">
                                    Your admin contact number is required before the first bus is created. It becomes the main support number connected to your company flow.
                                </p>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white/55">
                                <Icon icon="solar:bus-line-duotone" className="text-base text-[#E4E67A]" />
                                Step 2 unlocks after save
                            </div>
                        </div>

                        <div className="dashboard-surface-soft mt-6 rounded-[1.5rem] p-4">
                            <label className="block text-sm font-medium text-white/80">
                                Admin contact number
                                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                                    <input
                                        type="tel"
                                        value={requiredPhoneDraft}
                                        onChange={(event) => setRequiredPhoneDraft(formatIndiaPhoneInput(event.target.value))}
                                        placeholder="+91 9876543210"
                                        className="dashboard-input w-full rounded-2xl px-4 py-3 text-sm transition focus:border-[#CDD645]"
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
            </div>

        </section>
    );
}
