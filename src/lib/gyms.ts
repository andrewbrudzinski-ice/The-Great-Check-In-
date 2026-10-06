// Gym matching — mirrors public.check_in() so the demo behaves like production.
import { distanceM } from "./geo.ts";
import type { Gym } from "./types.ts";

export const activeGyms = (gyms: Gym[]) => gyms.filter((g) => !g.archived);
export const approvedGyms = (gyms: Gym[]) => gyms.filter((g) => !g.archived && g.status === "approved");

export type GymMatch =
  | { kind: "inside"; gym: Gym; distance: number }
  | { kind: "pending"; gym: Gym; distance: number }
  | { kind: "too_far"; gym: Gym; distance: number }
  | { kind: "none" };

/** Nearest approved gym you're inside of; else a pending one you're inside of; else the nearest. */
export function matchGym(gyms: Gym[], lat: number, lng: number): GymMatch {
  const measured = activeGyms(gyms).map((gym) => ({ gym, distance: distanceM(lat, lng, gym.latitude, gym.longitude) }));
  const approved = measured.filter((m) => m.gym.status === "approved").sort((a, b) => a.distance - b.distance);
  if (!approved.length) return { kind: "none" };
  const inside = approved.find((m) => m.distance <= m.gym.radiusM);
  if (inside) return { kind: "inside", ...inside };
  const pending = measured.find((m) => m.gym.status === "pending" && m.distance <= m.gym.radiusM);
  if (pending) return { kind: "pending", ...pending };
  return { kind: "too_far", ...approved[0] };
}
