"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { clearUser, fetchUser } from "@/lib/redux/userSlice";
import { useRouter, useSearchParams } from "next/navigation";
import Modal from "@/components/dashboard/Modal";
import { useToast } from "@/context/ToastContext";
import { formatIndiaPhoneInput, normalizeIndiaPhone } from "@/lib/phone";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

const roleLabel = (role: string | undefined) => {
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isMobile, isTablet } = useResponsiveMode();
  const { addToast } = useToast();
  const { user } = useAppSelector((state) => state.user);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setPhone(formatIndiaPhoneInput(user?.phone ?? ""));
  }, [user?.name, user?.phone]);

  const normalizedName = useMemo(() => name.trim().replace(/\s+/g, " "), [name]);
  const comparablePhoneValue = useMemo(
    () => normalizeIndiaPhone(phone) ?? formatIndiaPhoneInput(phone),
    [phone],
  );
  const currentSavedPhone = useMemo(
    () => normalizeIndiaPhone(user?.phone ?? "") ?? formatIndiaPhoneInput(user?.phone ?? ""),
    [user?.phone],
  );
  const currentSavedName = useMemo(() => (user?.name ?? "").trim(), [user?.name]);
  const hasChanged = normalizedName !== currentSavedName || comparablePhoneValue !== currentSavedPhone;
  const isOperatorMissingPhone = useMemo(
    () => user?.role === "operator" && !normalizeIndiaPhone(user?.phone),
    [user?.phone, user?.role],
  );
  const mustChangePassword = Boolean(user?.mustChangePassword);
  const assignedBusCount = Number(user?.assignedBusCount ?? 0);
  const adminContactPhone = String(user?.adminContactPhone ?? "").trim();
  const deletionBlockedByBusAssignments =
    user?.role === "operator" && assignedBusCount > 0;
  const forcePasswordChange = mustChangePassword || searchParams.get("forcePasswordChange") === "true";
  const deletionExpiryLabel = useMemo(() => {
    const expiresAt = user?.accountDeletionExpiresAt;
    if (!expiresAt) return null;

    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) return null;

    return parsed.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [user?.accountDeletionExpiresAt]);

  const getLogoutRedirectPath = () => {
    if (user?.role === "admin") return "/admin/login";
    if (user?.role === "operator") return "/operator/login";
    return "/login";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setFieldError("");

    if (normalizedName.length < 2) {
      setFieldError("Name must be at least 2 characters.");
      return;
    }

    const normalizedPhone = normalizeIndiaPhone(phone);
    if (normalizedPhone === "") {
      setFieldError("Contact number is required.");
      return;
    }

    if (normalizedPhone === null) {
      setFieldError("Enter a valid Indian mobile number.");
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

  const handleScheduleAccountDeletion = async () => {
    setDeleteAccountError("");

    try {
      setDeletingAccount(true);
      const response = await fetch("/api/auth/me", {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        if (payload?.code === "OPERATOR_ASSIGNED_TO_BUSES") {
          await dispatch(fetchUser()).unwrap().catch(() => undefined);
        }
        setDeleteAccountError(payload?.message || "Failed to schedule account deletion.");
        return;
      }

      const redirectPath = getLogoutRedirectPath();
      sessionStorage.setItem("logout_redirect", redirectPath);
      dispatch(clearUser());
      addToast(payload?.message || "Account deletion scheduled.", "warning");
      router.replace(`${redirectPath}?deletionScheduled=true`);
    } catch (err: unknown) {
      setDeleteAccountError(
        err instanceof Error ? err.message : "Failed to schedule account deletion.",
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (!mustChangePassword && !currentPassword) {
      setPasswordError("Current password is required.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password must match.");
      return;
    }

    try {
      setChangingPassword(true);
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setPasswordError(payload?.message || "Failed to update password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(payload?.message || "Password updated successfully.");
      await dispatch(fetchUser()).unwrap();

      if (forcePasswordChange) {
        addToast("Password updated. You can continue using the dashboard.", "success");
        router.replace("/dashboard/profile");
      }
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="dashboard-surface rounded-2xl p-5 sm:p-6">
        <div className={`flex gap-4 ${isMobile ? "flex-col" : "flex-wrap items-start justify-between"}`}>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#D7E18D]/80">Dashboard Profile</p>
            <h1 className={`mt-2 font-bold text-[#F6FF6A] ${isMobile ? "text-2xl" : "text-2xl sm:text-3xl"}`}>Account Settings</h1>
            <p className={`mt-2 text-white/70 ${isMobile ? "text-sm leading-6" : "text-sm"}`}>
              Manage your profile details and keep your contact info up to date.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#C9D86C]/35 bg-[#C9D86C]/10 px-3 py-1.5 text-xs font-semibold text-[#EAF3A0]">
            <Icon icon="mdi:account-check-outline" className="text-base" />
            {roleLabel(user.role)}
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

      <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : isTablet ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"}`}>
        <div className="dashboard-surface-soft rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wide text-white/55">Full Name</p>
          <p className="mt-2 text-sm font-medium text-white">{user.name || "-"}</p>
        </div>
        <div className="dashboard-surface-soft rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wide text-white/55">Email</p>
          <p className="mt-2 break-all text-sm font-medium text-white">{user.email}</p>
        </div>
        <div className="dashboard-surface-soft rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wide text-white/55">Role</p>
          <p className="mt-2 text-sm font-medium text-white">{roleLabel(user.role)}</p>
        </div>
        <div className="dashboard-surface-soft rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wide text-white/55">Company Status</p>
          <p className="mt-2 text-sm font-medium text-white">
            {companyStatusLabel(user.operatorApprovalStatus, user.role)}
          </p>
        </div>
      </div>

      <div className="dashboard-surface rounded-2xl p-5 sm:p-6">
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
              className="dashboard-input mt-2 w-full rounded-xl px-4 py-3 text-base transition focus:border-[#D7E18D]/70"
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
                setPhone(formatIndiaPhoneInput(event.target.value));
              }}
              placeholder="+91 9876543210"
              className="dashboard-input mt-2 w-full rounded-xl px-4 py-3 text-base transition focus:border-[#D7E18D]/70"
            />
          </label>

          <p className="text-xs text-white/60">
            Format: +91 followed by a valid 10-digit Indian mobile number.
          </p>

          {fieldError && <p className="text-xs text-red-400">{fieldError}</p>}

          <div className={`flex gap-3 pt-1 ${isMobile ? "flex-col" : "flex-wrap items-center justify-end"}`}>
            {!hasChanged && <span className="text-xs text-white/55">No unsaved changes</span>}
            <button
              type="submit"
              disabled={saving || !hasChanged}
              className={`inline-flex items-center gap-2 rounded-full border border-[#D5E400] px-6 py-2 font-semibold text-[#D5E400] transition-all duration-300 hover:bg-[#D5E400] hover:text-black hover:shadow-2xl hover:shadow-[#D5E400]/50 disabled:cursor-not-allowed disabled:opacity-60 ${isMobile ? "w-full justify-center" : ""}`}
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

      <div className={`rounded-2xl p-5 sm:p-6 ${
        forcePasswordChange
          ? "border-amber-400/45 bg-amber-500/10"
          : "dashboard-surface"
      }`}>
        <div className="mb-4 flex items-center gap-2">
          <Icon
            icon={forcePasswordChange ? "mdi:shield-alert-outline" : "mdi:form-textbox-password"}
            className={`text-lg ${forcePasswordChange ? "text-amber-200" : "text-[#DDE678]"}`}
          />
          <h2 className={`text-lg font-semibold ${forcePasswordChange ? "text-amber-100" : "text-[#F2F7B2]"}`}>
            {forcePasswordChange ? "Update Temporary Password" : "Change Password"}
          </h2>
        </div>

        {forcePasswordChange && (
          <div className="mb-4 rounded-xl border border-amber-400/45 bg-amber-500/10 p-3 text-sm text-amber-100">
            This account was created with a temporary password. Update it now before continuing.
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          {!mustChangePassword && (
            <label className="block text-sm text-white/85">
              Current Password
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => {
                  setPasswordError("");
                  setPasswordMessage("");
                  setCurrentPassword(event.target.value);
                }}
                placeholder="Current password"
                className="dashboard-input mt-2 w-full rounded-xl px-4 py-3 text-base transition focus:border-[#D7E18D]/70"
              />
            </label>
          )}

          <label className="block text-sm text-white/85">
            New Password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => {
                setPasswordError("");
                setPasswordMessage("");
                setNewPassword(event.target.value);
              }}
              placeholder="New password"
              className="dashboard-input mt-2 w-full rounded-xl px-4 py-3 text-base transition focus:border-[#D7E18D]/70"
            />
          </label>

          <label className="block text-sm text-white/85">
            Confirm New Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                setPasswordError("");
                setPasswordMessage("");
                setConfirmPassword(event.target.value);
              }}
              placeholder="Confirm new password"
              className="dashboard-input mt-2 w-full rounded-xl px-4 py-3 text-base transition focus:border-[#D7E18D]/70"
            />
          </label>

          <p className="text-xs text-white/60">
            Operators can also configure Google login later using the same email address.
          </p>

          {passwordError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {passwordError}
            </div>
          )}
          {passwordMessage && (
            <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
              {passwordMessage}
            </div>
          )}

          <div className={`${isMobile ? "flex flex-col" : "flex justify-end"}`}>
            <button
              type="submit"
              disabled={changingPassword}
              className={`inline-flex items-center gap-2 rounded-full border border-[#D5E400] px-6 py-2 font-semibold text-[#D5E400] transition-all duration-300 hover:bg-[#D5E400] hover:text-black hover:shadow-2xl hover:shadow-[#D5E400]/50 disabled:cursor-not-allowed disabled:opacity-60 ${isMobile ? "w-full justify-center" : ""}`}
            >
              {changingPassword ? (
                <>
                  <Icon icon="svg-spinners:ring-resize" className="text-base" />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-rose-500/35 bg-rose-950/20 p-5 sm:p-6">
        <div className={`flex gap-4 ${isMobile ? "flex-col" : "items-start justify-between"}`}>
          <div>
            <div className="flex items-center gap-2">
              <Icon icon="mdi:alert-circle-outline" className="text-lg text-rose-300" />
              <h2 className="text-lg font-semibold text-rose-200">Danger Zone</h2>
            </div>
            <p className="mt-2 text-sm text-rose-100/80">
              Schedule account deletion with a 3-day recovery window. Logging in again before expiry cancels deletion automatically.
            </p>
            {deletionBlockedByBusAssignments ? (
              <p className="mt-2 text-xs text-amber-200/90">
                You are still assigned to {assignedBusCount} bus{assignedBusCount === 1 ? "" : "es"}.
                {adminContactPhone
                  ? ` Contact admin at ${adminContactPhone} to manage those assignments before deletion.`
                  : " Contact your admin to manage those assignments before deletion."}
              </p>
            ) : null}
            {deletionExpiryLabel && (
              <p className="mt-2 text-xs text-rose-200/90">
                Scheduled deletion expires on {deletionExpiryLabel}.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setDeleteAccountError("");
              setDeleteModalOpen(true);
            }}
            className={`inline-flex items-center gap-2 rounded-full border border-rose-400/50 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 ${isMobile ? "w-full justify-center" : ""}`}
          >
            <Icon icon="mdi:delete-outline" className="text-base" />
            Delete Account
          </button>
        </div>
      </div>

      <Modal
        isOpen={deleteModalOpen}
        title="Confirm Account Deletion"
        onClose={() => {
          if (deletingAccount) return;
          setDeleteModalOpen(false);
          setDeleteAccountError("");
        }}
      >
        <div className="space-y-4">
          {deletionBlockedByBusAssignments ? (
            <>
              <p className="text-sm text-white/80">
                Account deletion is blocked because you are still assigned to {assignedBusCount} bus{assignedBusCount === 1 ? "" : "es"}.
              </p>
              <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-3 text-sm text-amber-100">
                {adminContactPhone
                  ? `Please contact your admin at ${adminContactPhone} to update bus assignments before deleting this operator account.`
                  : "Please contact your admin to update bus assignments before deleting this operator account."}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-white/80">
                Your account will be scheduled for deletion and you will be logged out immediately.
                Log in again within 3 days to cancel the deletion request.
              </p>
              <div className="rounded-xl border border-rose-400/35 bg-rose-500/10 p-3 text-sm text-rose-100">
                This affects your current account only. If you do not log back in before the expiry window ends,
                the scheduled deletion will stay in place.
              </div>
            </>
          )}
          {deleteAccountError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
              {deleteAccountError}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setDeleteModalOpen(false);
                setDeleteAccountError("");
              }}
              disabled={deletingAccount}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/75 transition hover:bg-white/10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={
                deletionBlockedByBusAssignments
                  ? () => {
                      setDeleteModalOpen(false);
                      setDeleteAccountError("");
                    }
                  : handleScheduleAccountDeletion
              }
              disabled={deletingAccount}
              className="inline-flex items-center gap-2 rounded-full border border-rose-400/50 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
            >
              {deletionBlockedByBusAssignments ? (
                "Close"
              ) : deletingAccount ? (
                <>
                  <Icon icon="svg-spinners:ring-resize" className="text-base" />
                  Scheduling...
                </>
              ) : (
                "Confirm Deletion"
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
