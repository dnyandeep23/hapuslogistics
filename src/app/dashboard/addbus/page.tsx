"use client";

import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";
import LoadingScreen from "@/components/LoadingScreen";
import AdminBusForm from "@/components/admin/AdminBusForm";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { fetchUser } from "@/lib/redux/userSlice";

export default function AddBusPage() {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const { addToast } = useToast();
    const { user, loading } = useAppSelector((state) => state.user);
    const isAdmin = user?.role === "admin" || user?.isSuperAdmin;
    const [requiredPhoneDraft, setRequiredPhoneDraft] = useState("");
    const [requiredPhoneError, setRequiredPhoneError] = useState("");
    const [savingRequiredPhone, setSavingRequiredPhone] = useState(false);
    const requiresAdminPhone = isAdmin && !String(user?.phone ?? "").trim();

    useEffect(() => {
        // After the initial load, if there's no user, redirect to login.
        if (!loading && !isAdmin) {
            addToast("You are not authorized to view this page.", "error");
            router.push('/dashboard');
        }
    }, [user, loading, router, addToast, isAdmin]);

    useEffect(() => {
        if (!requiresAdminPhone) return;
        setRequiredPhoneDraft("");
        setRequiredPhoneError("");
    }, [requiresAdminPhone]);

    const saveRequiredPhone = async () => {
        const phone = requiredPhoneDraft.trim();
        if (!phone) {
            setRequiredPhoneError("Contact number is required.");
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
        <section className="min-h-screen bg-[#171C14] px-4 pb-12 pt-6 sm:px-6 lg:px-10">
            <div className="mx-auto w-full max-w-6xl space-y-6">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#C8D853]/35 bg-[#232B1C] px-3 py-2 text-sm font-semibold text-[#EAF489] transition hover:border-[#C8D853]/55 hover:bg-[#293223]"
                >
                    <Icon icon="solar:arrow-left-outline" className="text-base" />
                    Back
                </button>

                <div>
                    <h1 className="text-2xl font-bold text-[#F4F8BF] sm:text-3xl">Add New Bus</h1>
                    <p className="mt-1 text-sm text-white/65">
                        Configure bus details, route flow, pricing and media in one guided setup.
                    </p>
                </div>

                {!requiresAdminPhone ? (
                    <AdminBusForm
                        mode="create"
                        cancelHref="/dashboard/buses"
                        successHref="/dashboard/buses"
                    />
                ) : null}
            </div>

            {requiresAdminPhone ? (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" />
                    <div className="relative w-full max-w-md rounded-2xl border border-[#5E6A4F] bg-[#1F271A] p-5 shadow-2xl">
                        <h2 className="text-lg font-semibold text-[#F6FF6A]">Add Contact Number</h2>
                        <p className="mt-2 text-sm text-white/75">
                            Add your contact number first. This is required before adding a bus.
                        </p>
                        <input
                            type="tel"
                            value={requiredPhoneDraft}
                            onChange={(event) => setRequiredPhoneDraft(event.target.value)}
                            placeholder="Enter contact number"
                            className="mt-4 w-full rounded-lg border border-[#5E6A4F] bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]"
                        />
                        {requiredPhoneError ? (
                            <p className="mt-2 text-xs text-red-300">{requiredPhoneError}</p>
                        ) : null}
                        <button
                            type="button"
                            onClick={saveRequiredPhone}
                            disabled={savingRequiredPhone}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#6A774F] bg-[#25311E] px-3 py-2 text-sm font-semibold text-[#F6FF6A] hover:bg-[#2D3A24] disabled:opacity-60"
                        >
                            <Icon icon={savingRequiredPhone ? "line-md:loading-loop" : "mdi:content-save-outline"} className="text-sm" />
                            {savingRequiredPhone ? "Saving..." : "Save Contact Number"}
                        </button>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
