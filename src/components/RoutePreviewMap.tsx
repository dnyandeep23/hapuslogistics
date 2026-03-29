"use client";

import React, { useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

type RoutePreviewPoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  pointCategory: "pickup" | "drop";
  pointTime: string;
};

type Props = {
  points: RoutePreviewPoint[];
  routeGeometry?: Array<{ latitude: number; longitude: number }>;
  heightClassName?: string;
};

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FitRouteBounds({
  points,
  padding = [32, 32],
  singlePointZoom = 11,
}: {
  points: Array<[number, number]>;
  padding?: [number, number];
  singlePointZoom?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], singlePointZoom);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding });
  }, [map, points, padding, singlePointZoom]);

  return null;
}

export default function RoutePreviewMap({ points, routeGeometry = [], heightClassName = "h-72" }: Props) {
  const { isMobile, isTablet } = useResponsiveMode();
  const markerPositions = points.map((point) => [point.latitude, point.longitude] as [number, number]);
  const routePathPositions = routeGeometry
    .map((point) => [Number(point.latitude), Number(point.longitude)] as [number, number])
    .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude));
  const polylinePositions = routePathPositions.length >= 2 ? routePathPositions : markerPositions;
  const hasPoints = markerPositions.length > 0;
  const defaultCenter: [number, number] = hasPoints ? markerPositions[0] : [20.5937, 78.9629];
  // Responsive zoom: slightly wider on mobile, tighter on desktop for easier route reading.
  const defaultZoom = hasPoints
    ? (isMobile ? 4.5 : isTablet ? 6 : 8.5)
    : (isMobile ? 4 : 6);
  const fitPadding: [number, number] = isMobile ? [18, 18] : [32, 32];
  const singlePointZoom = isMobile ? 10 : isTablet ? 11 : 12;

  return (
    <div className={`overflow-hidden rounded-2xl border border-white/15 ${heightClassName}`}>
      <MapContainer center={defaultCenter} zoom={defaultZoom} className="h-full w-full" scrollWheelZoom>
        <FitRouteBounds
          points={polylinePositions.length > 0 ? polylinePositions : markerPositions}
          padding={fitPadding}
          singlePointZoom={singlePointZoom}
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {polylinePositions.length >= 2 && (
          <Polyline positions={polylinePositions} pathOptions={{ color: "#8EA937", weight: 4, opacity: 0.9 }} />
        )}

        {points.map((point, index) => (
          <Marker key={point.id} position={[point.latitude, point.longitude]}>
            <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
              <div className="text-xs leading-relaxed">
                <p className="font-semibold">
                  {index + 1}. {point.label}
                </p>
                <p>
                  {point.pointCategory.toUpperCase()} • {point.pointTime || "--:--"}
                </p>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
