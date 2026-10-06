"use client";

import L from "leaflet";
import { Fragment, useEffect, useMemo } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { MAP_TILE_ATTRIBUTION, MAP_TILE_IS_DEFAULT, MAP_TILE_MAX_NATIVE_ZOOM, MAP_TILE_URL } from "@/lib/config";
import type { CheckIn, Gym, Player } from "@/lib/types";
import { formatDistance } from "@/lib/geo";
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
      background:#111317;border:2.5px solid ${p.color};box-shadow:0 2px 6px rgba(0,0,0,.35)${
        highlighted ? `,0 0 22px ${p.color}` : ""
      }">${inner}</div>`,
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function FitBounds({ points, focus }: { points: [number, number][]; focus: [number, number] | null }) {
  const map = useMap();
  const key = JSON.stringify(points.length ? [points.length, points[0], points[points.length - 1]] : []);
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], MAP_TILE_MAX_NATIVE_ZOOM + 1);
    else map.fitBounds(L.latLngBounds(points).pad(0.3), { maxZoom: MAP_TILE_MAX_NATIVE_ZOOM + 1 });
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
  gyms,
  timezone,
  selectedId,
  onSelect,
  focusGymId,
  className = "",
}: {
  checkIns: CheckIn[];
  players: Player[];
  gyms: Gym[];
  timezone: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Fly to this gym (e.g. tapping it in a list). */
  focusGymId?: string | null;
  className?: string;
}) {
  const shownGyms = useMemo(() => gyms.filter((g) => !g.archived), [gyms]);
  // Frame the check-ins plus the gyms they happened at (or every gym when there are none).
  const points = useMemo(() => {
    const pins = checkIns.map((c) => [c.latitude, c.longitude] as [number, number]);
    const used = new Set(checkIns.map((c) => c.gymId));
    const frameGyms = pins.length ? shownGyms.filter((g) => used.has(g.id)) : shownGyms;
    return [...pins, ...frameGyms.map((g) => [g.latitude, g.longitude] as [number, number])];
  }, [checkIns, shownGyms]);
  const selected = checkIns.find((c) => c.id === selectedId) ?? null;
  const selectedGym = selected ? gyms.find((g) => g.id === selected.gymId) : undefined;
  const focusGym = shownGyms.find((g) => g.id === focusGymId);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  return (
    <MapContainer
      center={points[0] ?? [39.5, -98.35]}
      zoom={points.length ? MAP_TILE_MAX_NATIVE_ZOOM : 3}
      className={className}
      zoomControl={false}
      attributionControl
    >
      <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} maxNativeZoom={MAP_TILE_MAX_NATIVE_ZOOM} maxZoom={MAP_TILE_MAX_NATIVE_ZOOM + 2} className={MAP_TILE_IS_DEFAULT ? "tiles-dim" : ""} />
      <FitBounds
        points={points}
        focus={selected ? [selected.latitude, selected.longitude] : focusGym ? [focusGym.latitude, focusGym.longitude] : null}
      />
      {shownGyms.map((g) => {
        const pending = g.status === "pending";
        const color = pending ? "#7c828d" : "#c8ff3d";
        return (
          <Fragment key={g.id}>
            <Circle
              center={[g.latitude, g.longitude]}
              radius={g.radiusM}
              pathOptions={{ color, weight: 1.5, opacity: 0.6, fillColor: color, fillOpacity: pending ? 0.04 : 0.06, dashArray: pending ? "2 6" : "4 6" }}
            />
            <CircleMarker center={[g.latitude, g.longitude]} radius={5} pathOptions={{ color: "#08090b", weight: 2, fillColor: color, fillOpacity: 1 }}>
              <Popup>
                <b>{g.name}</b>
                <br />
                <span style={{ color: "#7c828d" }}>
                  {pending ? "Pending approval — check-ins don't count yet" : `Check-in radius ${g.radiusM} m`}
                  {g.createdBy && byId.get(g.createdBy) ? ` · added by ${byId.get(g.createdBy)!.name}` : ""}
                </span>
              </Popup>
            </CircleMarker>
          </Fragment>
        );
      })}
      {/* Selected check-in: GPS accuracy halo + line back to its gym */}
      {selected && (
        <>
          {selected.accuracy != null && (
            <Circle
              center={[selected.latitude, selected.longitude]}
              radius={selected.accuracy}
              pathOptions={{ color: byId.get(selected.userId)?.color ?? "#fff", weight: 1, opacity: 0.8, fillOpacity: 0.12 }}
            />
          )}
          {selectedGym && (
            <Polyline
              positions={[[selectedGym.latitude, selectedGym.longitude], [selected.latitude, selected.longitude]]}
              pathOptions={{ color: "#ffffff", weight: 1.5, opacity: 0.7, dashArray: "3 5" }}
            />
          )}
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
                <div>{formatDateTime(c.checkedInAt, timezone)}</div>
                <div style={{ color: "#7c828d" }}>{c.gymName}</div>
                {c.distanceM != null && (
                  <div style={{ color: "#4ade80", marginTop: 4 }}>
                    ✓ {formatDistance(c.distanceM)} from gym{c.accuracy != null ? ` · ±${formatDistance(c.accuracy)}` : ""}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
