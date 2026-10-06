/** Great-circle distance in meters (same formula as public.distance_m). */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  if (m < 100000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 1000).toLocaleString()} km`;
}

export type Fix = { latitude: number; longitude: number; accuracy: number };

export class LocationError extends Error {
  constructor(public code: "denied" | "unavailable" | "timeout" | "unsupported", message: string) {
    super(message);
  }
}

/**
 * One-shot GPS read. Only ever called when someone taps CHECK IN (or an admin
 * taps "use my location" in Settings) — the app never watches position.
 */
export function getCurrentFix(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new LocationError("unsupported", "This browser can't share location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new LocationError("denied", "Location permission denied."));
        else if (err.code === err.TIMEOUT) reject(new LocationError("timeout", "Couldn't get a GPS fix in time."));
        else reject(new LocationError("unavailable", "Location unavailable."));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}
