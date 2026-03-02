"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/redux/hooks";

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
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(makeEmptyForm());
  const [fieldErrors, setFieldErrors] = useState<LocationFieldErrors>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [locating, setLocating] = useState(false);

  const isAdmin = user?.role === "admin" || user?.isSuperAdmin;
  const mapSearchQuery = useMemo(
    () =>
      [form.name, form.address, form.city, form.state, form.zip]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(", "),
    [form.address, form.city, form.name, form.state, form.zip],
  );

  const selectedMapPoint = useMemo(() => {
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  }, [form.latitude, form.longitude]);

  const applyResolvedMapLocation = useCallback((resolved: ResolvedLocation) => {
    setForm((prev) => ({
      ...prev,
      name: prev.name.trim() ? prev.name : String(resolved.name ?? "").trim() || prev.name,
      address:
        String(resolved.addressLine ?? "").trim() ||
        String(resolved.displayName ?? "").trim() ||
        prev.address,
      city: String(resolved.city ?? "").trim() || prev.city,
      state: String(resolved.state ?? "").trim() || prev.state,
      zip: String(resolved.zip ?? "").trim() || prev.zip,
      latitude: Number(resolved.latitude).toFixed(6),
      longitude: Number(resolved.longitude).toFixed(6),
    }));

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

  const handleCreateLocation = async (event: React.FormEvent) => {
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
      const response = await fetch("/api/locations", {
        method: "POST",
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
        setError(payload?.message || "Failed to add location.");
        return;
      }

      setMessage(payload?.message || "Location added successfully.");
      setForm(makeEmptyForm());
      await loadLocations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add location.");
    } finally {
      setSaving(false);
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
      <div>
        <h1 className="text-2xl font-bold text-[#F6FF6A] sm:text-3xl">Pickup & Drop Locations</h1>
        <p className="mt-1 text-sm text-white/70">
          Add route points with map coordinates for accurate route distance and fare calculations.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-[#4E5A45] bg-[#243227] p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-[#E4E67A]">Add New Location</h2>
          <form onSubmit={handleCreateLocation} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-white/80">
                Name
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="e.g. Dadar TT"
                  className={`mt-2 w-full rounded-lg border bg-black px-3 py-2.5 text-base text-white/90 outline-none transition ${
                    fieldErrors.name ? "border-red-500" : "border-white/20 focus:border-[#D5E400]/70"
                  }`}
                />
                {fieldErrors.name && <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>}
              </label>

              <label className="text-sm text-white/80">
                City
                <input
                  value={form.city}
                  onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                  placeholder="e.g. Mumbai"
                  className={`mt-2 w-full rounded-lg border bg-black px-3 py-2.5 text-base text-white/90 outline-none transition ${
                    fieldErrors.city ? "border-red-500" : "border-white/20 focus:border-[#D5E400]/70"
                  }`}
                />
                {fieldErrors.city && <p className="mt-1 text-xs text-red-400">{fieldErrors.city}</p>}
              </label>

              <label className="text-sm text-white/80">
                State
                <input
                  value={form.state}
                  onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))}
                  placeholder="e.g. Maharashtra"
                  className={`mt-2 w-full rounded-lg border bg-black px-3 py-2.5 text-base text-white/90 outline-none transition ${
                    fieldErrors.state ? "border-red-500" : "border-white/20 focus:border-[#D5E400]/70"
                  }`}
                />
                {fieldErrors.state && <p className="mt-1 text-xs text-red-400">{fieldErrors.state}</p>}
              </label>

              <label className="text-sm text-white/80">
                ZIP Code
                <input
                  value={form.zip}
                  onChange={(event) => setForm((prev) => ({ ...prev, zip: event.target.value }))}
                  placeholder="e.g. 400014"
                  className={`mt-2 w-full rounded-lg border bg-black px-3 py-2.5 text-base text-white/90 outline-none transition ${
                    fieldErrors.zip ? "border-red-500" : "border-white/20 focus:border-[#D5E400]/70"
                  }`}
                />
                {fieldErrors.zip && <p className="mt-1 text-xs text-red-400">{fieldErrors.zip}</p>}
              </label>
            </div>

            <label className="text-sm text-white/80">
              Address
              <input
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Street / landmark"
                className={`mt-2 w-full rounded-lg border bg-black px-3 py-2.5 text-base text-white/90 outline-none transition ${
                  fieldErrors.address ? "border-red-500" : "border-white/20 focus:border-[#D5E400]/70"
                }`}
              />
              {fieldErrors.address && <p className="mt-1 text-xs text-red-400">{fieldErrors.address}</p>}
            </label>

            <div className="rounded-xl border border-white/15 bg-black/25 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-white/90">Map Coordinates</p>
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={locating}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D5E400]/40 px-2.5 py-1.5 text-xs font-semibold text-[#E4E67A] transition hover:border-[#D5E400]/70 disabled:opacity-60"
                >
                  <Icon icon="solar:gps-bold-duotone" className="text-sm" />
                  {locating ? "Locating..." : "Use Current Location"}
                </button>
              </div>

              <p className="mb-2 text-xs text-white/65">
                Tap the map to place pin, then drag pin for accurate pickup/drop location.
              </p>
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
                heightClassName="h-64 sm:h-72"
                searchQuery={mapSearchQuery}
              />

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs text-white/75">
                  Latitude
                  <input
                    value={form.latitude}
                    onChange={(event) => setForm((prev) => ({ ...prev, latitude: event.target.value }))}
                    placeholder="19.076090"
                    className={`mt-1 w-full rounded-lg border bg-black px-3 py-2 text-sm text-white/90 outline-none transition ${
                      fieldErrors.latitude ? "border-red-500" : "border-white/20 focus:border-[#D5E400]/70"
                    }`}
                  />
                  {fieldErrors.latitude && <p className="mt-1 text-xs text-red-400">{fieldErrors.latitude}</p>}
                </label>
                <label className="text-xs text-white/75">
                  Longitude
                  <input
                    value={form.longitude}
                    onChange={(event) => setForm((prev) => ({ ...prev, longitude: event.target.value }))}
                    placeholder="72.877426"
                    className={`mt-1 w-full rounded-lg border bg-black px-3 py-2 text-sm text-white/90 outline-none transition ${
                      fieldErrors.longitude ? "border-red-500" : "border-white/20 focus:border-[#D5E400]/70"
                    }`}
                  />
                  {fieldErrors.longitude && <p className="mt-1 text-xs text-red-400">{fieldErrors.longitude}</p>}
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-[#D5E400] bg-[#D5E400]/10 px-5 py-2.5 text-sm font-semibold text-[#E4E67A] transition hover:bg-[#D5E400] hover:text-black disabled:opacity-60"
              >
                <Icon icon="solar:add-circle-bold-duotone" />
                {saving ? "Adding..." : "Add Location"}
              </button>
            </div>
          </form>

          {error && <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
          {message && <div className="mt-4 rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">{message}</div>}
        </div>

        <div className="rounded-2xl border border-[#4E5A45] bg-[#243227] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#E4E67A]">Existing Locations</h2>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, city, state..."
              className="w-full rounded-lg border border-white/20 bg-black px-3 py-2.5 text-sm text-white/90 outline-none transition sm:w-72 focus:border-[#D5E400]/70"
            />
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-white/70">Loading locations...</p>
          ) : filteredLocations.length === 0 ? (
            <p className="mt-4 text-sm text-white/70">No locations found.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredLocations.map((location) => {
                const latitude = Number(location.latitude);
                const longitude = Number(location.longitude);
                const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

                return (
                  <div key={location._id} className="rounded-xl border border-white/15 bg-black/25 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[#E4E67A]">{location.name}</p>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        hasCoordinates ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"
                      }`}>
                        {hasCoordinates ? "Mapped" : "No Map"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/80">{location.address}</p>
                    <p className="mt-2 text-xs text-white/70">
                      {location.city}, {location.state} - {location.zip}
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-white/65">
                      <Icon icon="solar:map-point-wave-bold" className="text-sm text-[#D5E400]" />
                      {hasCoordinates
                        ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                        : "Coordinates unavailable"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
