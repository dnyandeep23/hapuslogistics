"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { fetchUser } from "@/lib/redux/userSlice";

const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

const normalizePhoneInput = (value: string) => value.replace(/[^\d+\s()-]/g, "").slice(0, 20);
const cleanPhone = (value: string) => value.trim().replace(/[\s()-]/g, "");

const roleLabel = (role: string | undefined, isSuperAdmin?: boolean) => {
  if (isSuperAdmin) return "Super Admin";
  if (role === "admin") return "Admin";
  if (role === "operator") return "Operator";
  return "User";
};

const companyStatusLabel = (status: string | undefined, role: string | undefined) => {
  if (role !== "operator") return "N/A";
  if (!status || status === "none") return "Not Linked";
  if (status === "approved") return "Approved";
  if (status === "pending" || status === "operator_requested" || status === "company_requested") {
    return "Pending Approval";
  }
  if (status === "rejected") return "Rejected";
  return "Not Linked";
};

export default function DashboardProfilePage() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.user);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
  }, [user?.name, user?.phone]);

  const normalizedName = useMemo(() => name.trim().replace(/\s+/g, " "), [name]);
  const cleanedPhoneValue = useMemo(() => cleanPhone(phone), [phone]);
  const currentSavedPhone = useMemo(() => cleanPhone(user?.phone ?? ""), [user?.phone]);
  const currentSavedName = useMemo(() => (user?.name ?? "").trim(), [user?.name]);
  const hasChanged = normalizedName !== currentSavedName || cleanedPhoneValue !== currentSavedPhone;
  const isOperatorMissingPhone = useMemo(
    () => user?.role === "operator" && !currentSavedPhone,
    [currentSavedPhone, user?.role],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setFieldError("");

    if (normalizedName.length < 2) {
      setFieldError("Name must be at least 2 characters.");
      return;
    }

    const normalizedPhone = cleanedPhoneValue;
    if (!normalizedPhone) {
      setFieldError("Contact number is required.");
      return;
    }

    if (!PHONE_PATTERN.test(normalizedPhone)) {
      setFieldError("Enter a valid contact number (10-15 digits).");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: normalizedName,
          phone: normalizedPhone,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.message || "Failed to update profile.");
        return;
      }

      setMessage(payload?.message || "Profile updated successfully.");
      await dispatch(fetchUser()).unwrap();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="rounded-2xl border border-[#4E5A45] bg-[#243227]/95 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#D7E18D]/80">Dashboard Profile</p>
            <h1 className="mt-2 text-2xl font-bold text-[#F6FF6A] sm:text-3xl">Account Settings</h1>
            <p className="mt-2 text-sm text-white/70">
              Manage your profile details and keep your contact info up to date.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#C9D86C]/35 bg-[#C9D86C]/10 px-3 py-1.5 text-xs font-semibold text-[#EAF3A0]">
            <Icon icon="mdi:account-check-outline" className="text-base" />
            {roleLabel(user.role, user.isSuperAdmin)}
          </div>
        </div>
      </div>

      {isOperatorMissingPhone && (
        <div className="rounded-2xl border border-amber-400/45 bg-amber-500/10 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Icon icon="mdi:alert-outline" className="mt-0.5 text-xl text-amber-300" />
            <div>
              <p className="text-sm font-semibold text-amber-200">Phone number required for bookings</p>
              <p className="mt-1 text-sm text-amber-100/90">
                Add your phone number to continue with bookings and operator assignment flows.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-wide text-white/55">Full Name</p>
          <p className="mt-2 text-sm font-medium text-white">{user.name || "-"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-wide text-white/55">Email</p>
          <p className="mt-2 break-all text-sm font-medium text-white">{user.email}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-wide text-white/55">Role</p>
          <p className="mt-2 text-sm font-medium text-white">{roleLabel(user.role, user.isSuperAdmin)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-wide text-white/55">Company Status</p>
          <p className="mt-2 text-sm font-medium text-white">
            {companyStatusLabel(user.operatorApprovalStatus, user.role)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#4E5A45] bg-[#243227] p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Icon icon="mdi:account-edit-outline" className="text-lg text-[#DDE678]" />
          <h2 className="text-lg font-semibold text-[#F2F7B2]">Editable Details</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm text-white/85">
            Full Name
            <input
              value={name}
              onChange={(event) => {
                setFieldError("");
                setError("");
                setMessage("");
                setName(event.target.value.slice(0, 80));
              }}
              placeholder="Your full name"
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/35 px-4 py-3 text-base text-white outline-none transition focus:border-[#D7E18D]/70"
            />
          </label>

          <label className="block text-sm text-white/85">
            Contact Number
            <input
              value={phone}
              onChange={(event) => {
                setFieldError("");
                setError("");
                setMessage("");
                setPhone(normalizePhoneInput(event.target.value));
              }}
              placeholder="+919876543210"
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/35 px-4 py-3 text-base text-white outline-none transition focus:border-[#D7E18D]/70"
            />
          </label>

          <p className="text-xs text-white/60">
            Format: optional + and 10-15 digits. Example: +919876543210
          </p>

          {fieldError && <p className="text-xs text-red-400">{fieldError}</p>}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            {!hasChanged && <span className="text-xs text-white/55">No unsaved changes</span>}
            <button
              type="submit"
              disabled={saving || !hasChanged}
              className="inline-flex items-center gap-2 rounded-full border border-[#D5E400] px-6 py-2 font-semibold text-[#D5E400] transition-all duration-300 hover:bg-[#D5E400] hover:text-black hover:shadow-2xl hover:shadow-[#D5E400]/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Icon icon="svg-spinners:ring-resize" className="text-base" />
                  Saving...
                </>
              ) : (
                "Save Profile"
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
