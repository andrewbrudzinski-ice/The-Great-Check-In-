import type { Settings } from "./types";

/**
 * Defaults used before an admin configures the club. The gym location is
 * intentionally empty: set it in Settings (there's a "use my location" button).
 */
export const DEFAULT_SETTINGS: Settings = {
  appTitle: "The Great Check In",
  appSubtitle: "5 check-ins. Every week. No excuses.",
  gymName: "The Gym",
  gymLatitude: null,
  gymLongitude: null,
  checkInRadius: 150,
  weeklyRequirement: 5,
  cooldownHours: 4,
  punishment: "Loser buys everyone lunch.",
  timezone: "America/New_York",
};

/** Fixed player color order — color follows the player, never their rank. */
export const PLAYER_COLORS = ["#c8ff3d", "#3dd9ff", "#ff5c8a", "#b18cff", "#ffb547", "#4ade80"];

export const AVATAR_CHOICES = ["💪", "🦍", "🐻", "🦈", "🐺", "🦁", "🔥", "⚡️", "🏋️", "🥩", "🧢", "👑", "🐐", "🤖", "🦖", "🍗"];

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const IS_DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

/**
 * Map tiles. Default: Esri's keyless dark gray canvas (native detail to z16,
 * upscaled beyond). Swap in Mapbox, Stadia, MapTiler etc. with env vars, e.g.
 * NEXT_PUBLIC_MAP_TILE_URL=https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=…
 */
export const MAP_TILE_IS_DEFAULT = !process.env.NEXT_PUBLIC_MAP_TILE_URL;
export const MAP_TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ||
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
export const MAP_TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const MAP_TILE_MAX_NATIVE_ZOOM = Number(process.env.NEXT_PUBLIC_MAP_TILE_MAX_ZOOM || (process.env.NEXT_PUBLIC_MAP_TILE_URL ? 20 : 16));
