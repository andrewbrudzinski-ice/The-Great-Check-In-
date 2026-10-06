import { test } from "node:test";
import assert from "node:assert/strict";
import { matchGym } from "./gyms.ts";
import type { Gym } from "./types.ts";

const g = (id: string, lat: number, lng: number, extra: Partial<Gym> = {}): Gym => ({
  id, name: id, latitude: lat, longitude: lng, radiusM: 150, status: "approved",
  createdBy: null, approvedBy: null, archived: false, createdAt: "", ...extra,
});

test("matches the nearest approved gym you're inside", () => {
  const gyms = [g("a", 40.7359, -73.9911), g("b", 40.7505, -73.9934), g("c", 40.73595, -73.9911, { radiusM: 50 })];
  const m = matchGym(gyms, 40.73596, -73.99111);
  assert.equal(m.kind, "inside");
  assert.equal(m.kind === "inside" && m.gym.id, "c");
  const m2 = matchGym(gyms, 40.7506, -73.9935);
  assert.equal(m2.kind === "inside" && m2.gym.id, "b");
});

test("pending, archived and too far", () => {
  const gyms = [g("a", 40.7359, -73.9911), g("p", 40.8, -73.95, { status: "pending" }), g("x", 40.9, -73.9, { archived: true })];
  assert.equal(matchGym(gyms, 40.8, -73.95).kind, "pending");
  assert.equal(matchGym(gyms, 40.9, -73.9).kind, "too_far"); // archived gyms don't count
  const far = matchGym(gyms, 40.76, -73.98);
  assert.equal(far.kind === "too_far" && far.gym.id, "a");
  assert.equal(matchGym([g("p", 0, 0, { status: "pending" })], 0, 0).kind, "none");
});
