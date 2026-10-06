"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { MAP_TILE_ATTRIBUTION, MAP_TILE_IS_DEFAULT, MAP_TILE_MAX_NATIVE_ZOOM, MAP_TILE_URL } from "@/lib/config";
import type { CheckIn, Player, Settings } from "@/lib/types";
import { formatDateTime } from "@/lib/week";


function iconFor(p: Player, highlighted: boolean) {
  const size = highlighted ? 40 : 30;
  const isUrl = /^https?:\/\//.test(p.avatar);
  const inner = isUrl
    ? `<img src="${encodeURI(p.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:999px" alt=""/>`
    : `<span style="font-size:${size * 0.5}px;line-height:1">${escapeHtml(p.avatar)}</span>`;
  return L.divIcon({
    className: "checkin-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;display:grid;place-items:center;overflow:hidden;
      background:#111317;border:2.5px solid ${p.color};box-shadow:0 0 0 3px rgba(8,9,11,.65),0 4px 14px rgba(0,0,0,.5)${
        highlighted ? `,0 0 22px ${p.color}` : ""
      }">${inner}</div>`,
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function FitBounds({ points, gym, focus }: { points: [number, number][]; gym: [number, number] | null; focus: [number, number] | null }) {
  const map = useMap();
  const key = JSON.stringify([points.length, gym]);
  useEffect(() => {
    const all = [...points, ...(gym ? [gym] : [])];
    if (all.length === 0) return;
    if (all.length === 1) map.setView(all[0], MAP_TILE_MAX_NATIVE_ZOOM + 1);
    else map.fitBounds(L.latLngBounds(all).pad(0.35), { maxZoom: MAP_TILE_MAX_NATIVE_ZOOM + 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  useEffect(() => {
    if (focus) map.flyTo(focus, Math.max(map.getZoom(), MAP_TILE_MAX_NATIVE_ZOOM + 1), { duration: 0.6 });
  }, [focus, map]);
  return null;
}

export default function CheckInMap({
  checkIns,
  players,
  settings,
  selectedId,
  onSelect,
  className = "",
}: {
  checkIns: CheckIn[];
  players: Player[];
  settings: Settings;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const gym: [number, number] | null =
    settings.gymLatitude != null && settings.gymLongitude != null ? [settings.gymLatitude, settings.gymLongitude] : null;
  const points = useMemo(() => checkIns.map((c) => [c.latitude, c.longitude] as [number, number]), [checkIns]);
  const selected = checkIns.find((c) => c.id === selectedId) ?? null;
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  return (
    <MapContainer
      center={gym ?? points[0] ?? [39.5, -98.35]}
      zoom={gym || points.length ? MAP_TILE_MAX_NATIVE_ZOOM : 3}
      className={className}
      zoomControl={false}
      attributionControl
    >
      <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} maxNativeZoom={MAP_TILE_MAX_NATIVE_ZOOM} maxZoom={MAP_TILE_MAX_NATIVE_ZOOM + 2} className={MAP_TILE_IS_DEFAULT ? "tiles-dim" : ""} />
      <FitBounds points={points} gym={gym} focus={selected ? [selected.latitude, selected.longitude] : null} />
      {gym && (
        <>
          <Circle
            center={gym}
            radius={settings.checkInRadius}
            pathOptions={{ color: "#c8ff3d", weight: 1.5, opacity: 0.6, fillColor: "#c8ff3d", fillOpacity: 0.06, dashArray: "4 6" }}
          />
          <CircleMarker center={gym} radius={5} pathOptions={{ color: "#08090b", weight: 2, fillColor: "#c8ff3d", fillOpacity: 1 }}>
            <Popup>
              <b>{settings.gymName}</b>
              <br />
              <span style={{ color: "#7c828d" }}>Check-in radius {settings.checkInRadius} m</span>
            </Popup>
          </CircleMarker>
        </>
      )}
      {checkIns.map((c) => {
        const p = byId.get(c.userId);
        if (!p) return null;
        const hl = c.id === selectedId;
        return (
          <Marker
            key={c.id + (hl ? "-hl" : "")}
            position={[c.latitude, c.longitude]}
            icon={iconFor(p, hl)}
            zIndexOffset={hl ? 1000 : 0}
            eventHandlers={{ click: () => onSelect?.(c.id) }}
          >
            <Popup>
              <div style={{ minWidth: 150 }}>
                <b style={{ color: p.color }}>{p.name}</b>
                <div>{formatDateTime(c.checkedInAt, settings.timezone)}</div>
                <div style={{ color: "#7c828d" }}>{c.gymName}</div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
