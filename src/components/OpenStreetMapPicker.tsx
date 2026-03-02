"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

type LatLngValue = {
  latitude: number;
  longitude: number;
};

type ResolvedLocation = {
  latitude: number;
  longitude: number;
  displayName?: string;
  name?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  source: "search" | "map";
};

type Props = {
  value: LatLngValue | null;
  onChange: (value: LatLngValue) => void;
  onLocationResolved?: (location: ResolvedLocation) => void;
  heightClassName?: string;
  searchQuery?: string;
  autoSelectSearchResult?: boolean;
};

// Use CDN icons so leaflet markers work in Next.js builds.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, map, zoom]);

  return null;
}

export default function OpenStreetMapPicker({
  value,
  onChange,
  onLocationResolved,
  heightClassName = "h-64",
  searchQuery = "",
  autoSelectSearchResult = true,
}: Props) {
  const [searchCenter, setSearchCenter] = useState<[number, number] | null>(null);
  const [searchStatus, setSearchStatus] = useState("");
  const normalizedQuery = searchQuery.trim();
  const hasSelectedMarker =
    typeof value?.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    typeof value?.longitude === "number" &&
    Number.isFinite(value.longitude);

  const viewCenter: [number, number] =
    hasSelectedMarker
      ? [Number(value?.latitude), Number(value?.longitude)]
      : searchCenter ?? [20.5937, 78.9629];

  const viewZoom = hasSelectedMarker || searchCenter ? 13 : 5;

  const resolveAddressByCoordinates = async (
    latitude: number,
    longitude: number,
    source: "search" | "map",
  ) => {
    try {
      const response = await fetch(
        `/api/locations/reverse-geocode?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}`,
        { method: "GET", cache: "no-store" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.result) return;

      if (source === "map") {
        const label = String(payload.result.displayName ?? "").trim();
        setSearchStatus(label ? `Pin selected: ${label}` : "Pin selected on map.");
      }

      if (onLocationResolved) {
        onLocationResolved({
          ...payload.result,
          latitude,
          longitude,
          source,
        } as ResolvedLocation);
      }
    } catch {
      // Ignore reverse-geocode failures; manual fields remain available.
    }
  };

  const handleMapPinPick = (latitude: number, longitude: number) => {
    onChange({ latitude, longitude });
    setSearchCenter([latitude, longitude]);
    void resolveAddressByCoordinates(latitude, longitude, "map");
  };

  useEffect(() => {
    if (normalizedQuery.length < 3) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        setSearchStatus(`Finding map view for "${normalizedQuery}"...`);
        const response = await fetch(`/api/locations/geocode?q=${encodeURIComponent(normalizedQuery)}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json();
        if (cancelled) return;

        if (!response.ok || !payload?.result) {
          setSearchStatus(payload?.message || "Map auto-focus not found for this location.");
          return;
        }

        const latitude = Number(payload.result.latitude);
        const longitude = Number(payload.result.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setSearchStatus("Invalid location coordinates from geocode.");
          return;
        }

        setSearchCenter([latitude, longitude]);
        if (autoSelectSearchResult) {
          onChange({ latitude, longitude });
        }
        if (onLocationResolved) {
          onLocationResolved({
            ...payload.result,
            latitude,
            longitude,
            source: "search",
          } as ResolvedLocation);
        }
        setSearchStatus(payload.result.displayName ? `Map focused: ${payload.result.displayName}` : "Map focused.");
      } catch {
        if (cancelled) return;
        setSearchStatus("Failed to auto-focus map.");
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [autoSelectSearchResult, normalizedQuery, onChange, onLocationResolved]);

  return (
    <div className="space-y-1.5">
      <div className={`overflow-hidden rounded-lg border border-white/20 ${heightClassName}`}>
        <MapContainer center={viewCenter} zoom={viewZoom} className="h-full w-full" scrollWheelZoom>
          <MapViewUpdater center={viewCenter} zoom={viewZoom} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler
            onPick={(lat, lng) => {
              handleMapPinPick(lat, lng);
            }}
          />

          {value && (
            <Marker
              position={[value.latitude, value.longitude]}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const marker = event.target;
                  const point = marker.getLatLng();
                  handleMapPinPick(point.lat, point.lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>
      {normalizedQuery.length >= 3 && searchStatus && (
        <p className="text-[11px] text-white/65">{searchStatus}</p>
      )}
    </div>
  );
}
