"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/redux/hooks";
import Skeleton from "@/components/Skeleton";
import ConfirmationModal from "@/components/dashboard/ConfirmationModal";

type AdminLocation = {
  _id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude?: number | null;
  longitude?: number | null;
  geoPoint?: {
    type?: string;
    coordinates?: number[];
  };
};

type LocationFieldErrors = Record<string, string>;
type ResolvedLocation = {
  latitude: number;
  longitude: number;
  displayName?: string;
  name?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  zip?: string;
};

const OpenStreetMapPicker = dynamic(() => import("@/components/OpenStreetMapPicker"), {
  ssr: false,
});

const makeEmptyForm = () => ({
  name: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  latitude: "",
  longitude: "",
});

export default function AdminLocationsPage() {
  const { user } = useAppSelector((state) => state.user);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingLocationId, setDeletingLocationId] = useState("");
  const [deleteLocationTarget, setDeleteLocationTarget] = useState<AdminLocation | null>(null);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(makeEmptyForm());
  const [fieldErrors, setFieldErrors] = useState<LocationFieldErrors>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";
  const mapSearchQuery = useMemo(
    () =>
      [form.name, form.address, form.city, form.state, form.zip]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(", "),
    [form.address, form.city, form.name, form.state, form.zip],
  );

  const selectedMapPoint = useMemo(() => {
    const latitudeText = String(form.latitude ?? "").trim();
    const longitudeText = String(form.longitude ?? "").trim();
    if (!latitudeText || !longitudeText) return null;

    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude < -90 || latitude > 90) return null;
    if (longitude < -180 || longitude > 180) return null;

    return { latitude, longitude };
  }, [form.latitude, form.longitude]);

  const applyResolvedMapLocation = useCallback((resolved: ResolvedLocation) => {
    setForm((prev) => {
      const resolvedName = String(resolved.name ?? "").trim();
      const resolvedAddress =
        String(resolved.addressLine ?? "").trim() ||
        String(resolved.displayName ?? "").trim();
      const resolvedCity = String(resolved.city ?? "").trim();
      const resolvedState = String(resolved.state ?? "").trim();
      const resolvedZip = String(resolved.zip ?? "").trim();
      const resolvedLatitude = Number(resolved.latitude).toFixed(6);
      const resolvedLongitude = Number(resolved.longitude).toFixed(6);

      return {
        ...prev,
        name: prev.name.trim() ? prev.name : resolvedName || prev.name,
        address: prev.address.trim() ? prev.address : resolvedAddress || prev.address,
        city: prev.city.trim() ? prev.city : resolvedCity || prev.city,
        state: prev.state.trim() ? prev.state : resolvedState || prev.state,
        zip: prev.zip.trim() ? prev.zip : resolvedZip || prev.zip,
        latitude: String(prev.latitude ?? "").trim() ? prev.latitude : resolvedLatitude,
        longitude: String(prev.longitude ?? "").trim() ? prev.longitude : resolvedLongitude,
      };
    });

    setFieldErrors((prev) => ({
      ...prev,
      address: "",
      city: "",
      state: "",
      zip: "",
      latitude: "",
      longitude: "",
    }));
  }, []);

  const loadLocations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/locations", { method: "GET" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message || "Failed to load locations.");
        return;
      }
      const normalizedLocations = Array.isArray(payload)
        ? payload.map((item) => {
            const location = item as Record<string, unknown>;
            const geoPoint = location.geoPoint && typeof location.geoPoint === "object"
              ? (location.geoPoint as Record<string, unknown>)
              : undefined;
            const coordinates = Array.isArray(geoPoint?.coordinates) ? geoPoint.coordinates : [];
            const latitudeValue = Number(location.latitude);
            const longitudeValue = Number(location.longitude);
            const geoLongitude = Number(coordinates[0]);
            const geoLatitude = Number(coordinates[1]);

            return {
              _id: String(location._id ?? ""),
              name: String(location.name ?? ""),
              address: String(location.address ?? ""),
              city: String(location.city ?? ""),
              state: String(location.state ?? ""),
              zip: String(location.zip ?? ""),
              latitude: Number.isFinite(latitudeValue)
                ? latitudeValue
                : Number.isFinite(geoLatitude)
                ? geoLatitude
                : null,
              longitude: Number.isFinite(longitudeValue)
                ? longitudeValue
                : Number.isFinite(geoLongitude)
                ? geoLongitude
                : null,
            };
          })
        : [];
      setLocations(normalizedLocations);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load locations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      router.replace("/dashboard");
      return;
    }
    loadLocations();
  }, [isAdmin, loadLocations, router]);

  const filteredLocations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return locations;

    return locations.filter((location) =>
      [location.name, location.city, location.state, location.address, location.zip]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [locations, query]);

  const handleSubmitLocation = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const nextErrors: LocationFieldErrors = {};
    if (!form.name.trim()) nextErrors.name = "Location name is required.";
    if (!form.address.trim()) nextErrors.address = "Address is required.";
    if (!form.city.trim()) nextErrors.city = "City is required.";
    if (!form.state.trim()) nextErrors.state = "State is required.";
    if (!form.zip.trim()) nextErrors.zip = "ZIP code is required.";
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      nextErrors.latitude = "Pick a valid latitude from map.";
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      nextErrors.longitude = "Pick a valid longitude from map.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError("Please fix the highlighted fields.");
      return;
    }

    setFieldErrors({});

    try {
      setSaving(true);
      
      const endpoint = editingLocationId ? `/api/locations/${editingLocationId}` : "/api/locations";
      const method = editingLocationId ? "PUT" : "POST";
      
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip,
          latitude,
          longitude,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.message || "Failed to save location.");
        return;
      }

      setMessage(payload?.message || "Location saved successfully.");
      setForm(makeEmptyForm());
      setIsAdding(false);
      setEditingLocationId(null);
      await loadLocations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save location.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddLocation = () => {
    setForm(makeEmptyForm());
    setEditingLocationId(null);
    setIsAdding(true);
    setFieldErrors({});
    setError("");
    setMessage("");
  };

  const handleOpenEditLocation = (loc: AdminLocation) => {
    setForm({
      name: loc.name,
      address: loc.address,
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
      latitude: loc.latitude !== null && loc.latitude !== undefined ? String(loc.latitude) : "",
      longitude: loc.longitude !== null && loc.longitude !== undefined ? String(loc.longitude) : "",
    });
    setEditingLocationId(loc._id);
    setIsAdding(true);
    setFieldErrors({});
    setError("");
    setMessage("");
  };

  const handleDeleteLocation = async (location: AdminLocation) => {
    setDeleteLocationTarget(location);
  };

  const confirmDeleteLocation = async () => {
    if (!deleteLocationTarget) return;
    const location = deleteLocationTarget;
    setDeleteLocationTarget(null);
    setError("");
    setMessage("");
    try {
      setDeletingLocationId(location._id);
      const response = await fetch(`/api/locations/${location._id}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.message || "Failed to delete location.");
        return;
      }

      setMessage(payload?.message || "Location deleted successfully.");
      setLocations((previous) => previous.filter((item) => item._id !== location._id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete location.");
    } finally {
      setDeletingLocationId("");
    }
  };

  const useCurrentLocation = () => {
    setError("");
    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this device/browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      () => {
        setError("Unable to fetch current location. Please pick on map.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#E4E67A] xl:text-3xl">Active Locations</h1>
          <p className="mt-1.5 text-sm text-white/50">
            Define service regions and geographical coordinates.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAddLocation}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#CDD645] px-5 py-3 text-sm font-bold text-black shadow-lg shadow-[#CDD645]/20 transition hover:bg-[#E4E67A]"
        >
          <Icon icon="solar:map-point-add-bold-duotone" className="text-lg" />
          Add Location
        </button>
      </div>

      <ConfirmationModal
        isOpen={Boolean(deleteLocationTarget)}
        title="Delete Location"
        description={
          deleteLocationTarget
            ? `Delete ${deleteLocationTarget.name} from locations?`
            : undefined
        }
        confirmLabel="Delete Location"
        confirmVariant="danger"
        isLoading={Boolean(deleteLocationTarget && deletingLocationId === deleteLocationTarget._id)}
        onClose={() => {
          if (deleteLocationTarget && deletingLocationId === deleteLocationTarget._id) return;
          setDeleteLocationTarget(null);
        }}
        onConfirm={confirmDeleteLocation}
      >
        <p className="text-sm text-white/70">
          This cannot be undone. If the location is still used by a bus route, deletion will be blocked.
        </p>
      </ConfirmationModal>

      <div className="grid grid-cols-1 gap-6">
        <div className="dashboard-surface rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-5">
            <h2 className="text-xl font-bold text-white/90">Existing Locations</h2>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, city, state..."
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/90 outline-none transition sm:w-72 focus:border-[#D5E400]/50 focus:bg-black/60 focus:shadow-[0_0_20px_rgba(213,228,0,0.1)]"
            />
          </div>

          {loading ? (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`location-skeleton-${index}`}
                  className="dashboard-surface-soft rounded-2xl p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Skeleton className="h-5 w-32 rounded-lg" />
                    <Skeleton className="h-5 w-16 rounded-lg" />
                  </div>
                  <Skeleton className="mt-4 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-3/4" />
                  <Skeleton className="mt-4 h-3 w-2/3" />
                </div>
              ))}
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="mt-6 flex h-40 items-center justify-center rounded-2xl border border-white/5 bg-white/5 text-sm font-medium text-white/50">
              No locations found.
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredLocations.map((location) => {
                const latitude = Number(location.latitude);
                const longitude = Number(location.longitude);
                const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

                return (
                  <div key={location._id} className="group overflow-hidden rounded-2xl border border-white/5 bg-[#141A14]/60 p-5 transition hover:border-white/10 hover:bg-[#1A221A]/80 shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-base font-bold tracking-wide text-[#E4E67A] line-clamp-1" title={location.name}>{location.name}</p>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditLocation(location)}
                          aria-label="Edit location"
                          className="rounded-lg bg-white/10 p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
                        >
                          <Icon icon="solar:pen-bold-duotone" className="text-lg" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLocation(location)}
                          disabled={deletingLocationId === location._id}
                          aria-label="Delete location"
                          className="rounded-lg bg-red-500/10 p-1.5 text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          <Icon icon="solar:trash-bin-trash-broken" className="text-lg" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs font-medium text-white/60 line-clamp-1">{location.address}</p>
                    <p className="mt-1 text-xs text-white/40">
                      {location.city}, {location.state} {location.zip}
                    </p>
                    <hr className="my-4 border-white/5" />
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        hasCoordinates ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${hasCoordinates ? "bg-emerald-400" : "bg-amber-400"}`} />
                        {hasCoordinates ? "Mapped" : "No Map"}
                      </span>
                      {hasCoordinates && (
                        <span className="text-[10px] font-mono text-white/40">
                          {latitude.toFixed(4)}, {longitude.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => !saving && setIsAdding(false)}
          />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#1A221A] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-white/10 bg-black/20 p-5">
              <h2 className="text-xl font-bold text-[#E4E67A]">{editingLocationId ? "Edit Location" : "New Location"}</h2>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                disabled={saving}
                className="rounded-full bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <Icon icon="mdi:close" className="text-xl" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-5 sm:p-6 custom-scrollbar">
              <form onSubmit={handleSubmitLocation} className="overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    Location Name
                    <input
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="e.g. Dadar TT"
                      className={`mt-2 w-full rounded-xl border bg-black/40 px-4 py-3 text-sm text-white shadow-inner transition-all focus:border-[#D5E400]/50 focus:bg-black/60 focus:outline-none ${
                        fieldErrors.name ? "border-red-500/50 focus:ring-1 focus:ring-red-500/50" : "border-white/10"
                      }`}
                    />
                    {fieldErrors.name && <p className="mt-1.5 text-[10px] text-red-400 normal-case">{fieldErrors.name}</p>}
                  </label>

                  <label className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    City
                    <input
                      value={form.city}
                      onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                      placeholder="e.g. Mumbai"
                      className={`mt-2 w-full rounded-xl border bg-black/40 px-4 py-3 text-sm text-white shadow-inner transition-all focus:border-[#D5E400]/50 focus:bg-black/60 focus:outline-none ${
                        fieldErrors.city ? "border-red-500/50 focus:ring-1 focus:ring-red-500/50" : "border-white/10"
                      }`}
                    />
                    {fieldErrors.city && <p className="mt-1.5 text-[10px] text-red-400 normal-case">{fieldErrors.city}</p>}
                  </label>

                  <label className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    State
                    <input
                      value={form.state}
                      onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))}
                      placeholder="e.g. Maharashtra"
                      className={`mt-2 w-full rounded-xl border bg-black/40 px-4 py-3 text-sm text-white shadow-inner transition-all focus:border-[#D5E400]/50 focus:bg-black/60 focus:outline-none ${
                        fieldErrors.state ? "border-red-500/50 focus:ring-1 focus:ring-red-500/50" : "border-white/10"
                      }`}
                    />
                    {fieldErrors.state && <p className="mt-1.5 text-[10px] text-red-400 normal-case">{fieldErrors.state}</p>}
                  </label>

                  <label className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    ZIP Code
                    <input
                      value={form.zip}
                      onChange={(event) => setForm((prev) => ({ ...prev, zip: event.target.value }))}
                      placeholder="e.g. 400014"
                      className={`mt-2 w-full rounded-xl border bg-black/40 px-4 py-3 text-sm text-white shadow-inner transition-all focus:border-[#D5E400]/50 focus:bg-black/60 focus:outline-none ${
                        fieldErrors.zip ? "border-red-500/50 focus:ring-1 focus:ring-red-500/50" : "border-white/10"
                      }`}
                    />
                    {fieldErrors.zip && <p className="mt-1.5 text-[10px] text-red-400 normal-case">{fieldErrors.zip}</p>}
                  </label>
                </div>

                <label className="text-xs font-semibold uppercase tracking-wider text-white/50 block">
                  Address
                  <input
                    value={form.address}
                    onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                    placeholder="Street / landmark"
                    className={`mt-2 w-full rounded-xl border bg-black/40 px-4 py-3 text-sm text-white shadow-inner transition-all focus:border-[#D5E400]/50 focus:bg-black/60 focus:outline-none ${
                      fieldErrors.address ? "border-red-500/50 focus:ring-1 focus:ring-red-500/50" : "border-white/10"
                    }`}
                  />
                  {fieldErrors.address && <p className="mt-1.5 text-[10px] text-red-400 normal-case">{fieldErrors.address}</p>}
                </label>

                <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Map Coordinates</p>
                    <button
                      type="button"
                      onClick={useCurrentLocation}
                      disabled={locating}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5E400]/30 bg-[#D5E400]/10 px-3 py-1.5 text-xs font-semibold text-[#E4E67A] transition hover:border-[#D5E400]/60 hover:bg-[#D5E400]/20 disabled:opacity-50"
                    >
                      <Icon icon="solar:gps-bold-duotone" className="text-sm" />
                      {locating ? "Locating..." : "Use My Location"}
                    </button>
                  </div>
                  
                  <div className="overflow-hidden rounded-xl border border-white/10 shadow-inner">
                    <OpenStreetMapPicker
                      value={selectedMapPoint}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          latitude: value.latitude.toFixed(6),
                          longitude: value.longitude.toFixed(6),
                        }))
                      }
                      onLocationResolved={applyResolvedMapLocation}
                      heightClassName="h-[240px] sm:h-[280px]"
                      searchQuery={mapSearchQuery}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">
                      Latitude
                      <input
                        value={form.latitude}
                        onChange={(event) => setForm((prev) => ({ ...prev, latitude: event.target.value }))}
                        className={`mt-1.5 w-full rounded-lg border bg-black/40 px-3 py-2.5 text-sm font-mono text-white/90 shadow-inner transition focus:border-[#D5E400]/50 focus:bg-black/60 focus:outline-none ${
                          fieldErrors.latitude ? "border-red-500/50 focus:ring-1 focus:ring-red-500/50" : "border-white/10"
                        }`}
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">
                      Longitude
                      <input
                        value={form.longitude}
                        onChange={(event) => setForm((prev) => ({ ...prev, longitude: event.target.value }))}
                        className={`mt-1.5 w-full rounded-lg border bg-black/40 px-3 py-2.5 text-sm font-mono text-white/90 shadow-inner transition focus:border-[#D5E400]/50 focus:bg-black/60 focus:outline-none ${
                          fieldErrors.longitude ? "border-red-500/50 focus:ring-1 focus:ring-red-500/50" : "border-white/10"
                        }`}
                      />
                    </label>
                  </div>
                </div>

                {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-medium text-red-300">{error}</div>}
              </form>
            </div>
            
            <div className="border-t border-white/10 bg-black/20 p-5">
              <button
                type="submit"
                form="add-location-form"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#D5E400] px-5 py-3.5 text-[15px] font-bold tracking-wide text-black shadow-lg shadow-[#D5E400]/20 transition-all hover:bg-[#E4E67A] active:scale-95 disabled:opacity-60"
              >
                <Icon icon={saving ? "line-md:loading-loop" : "solar:add-circle-bold-duotone"} className="text-xl" />
                {saving ? "Saving Location..." : "Save Location"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
