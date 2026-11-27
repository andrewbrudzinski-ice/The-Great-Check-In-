import { test } from "node:test";
import assert from "node:assert/strict";
import { computeGame } from "./game.ts";
import { firstToGoal } from "./season.ts";
import type { AppData, CheckIn, Player } from "./types.ts";
import { addDays, midnightIn } from "./week.ts";

const tz = "America/New_York";
const players: Player[] = ["A", "B", "C"].map((n, i) => ({
  id: n, name: n, avatar: "💪", color: "#fff", isAdmin: i === 0, isOwner: i === 0, createdAt: "2026-09-14T12:00:00Z", weeklyRequirement: null, paused: false,
}));
const ci = (userId: string, date: string, hour = 12): CheckIn => {
  const t = new Date(midnightIn(date, tz).getTime() + hour * 3600000).toISOString();
  return { id: userId + t, userId, latitude: 0, longitude: 0, accuracy: 5, distanceM: 1, radiusM: 150, gymId: "g", gymName: "G", manual: false, addedBy: null, note: null, checkedInAt: t };
};
const data = (checkIns: CheckIn[], over: Partial<AppData> = {}): AppData => ({
  players, checkIns, results: [], punishments: [], gyms: [], challenges: [], challengeLogs: [], challengePicks: [], programs: [], programDays: [], messages: [], reactions: [],
  settings: { appTitle: "", appSubtitle: "", checkInRadius: 150, weeklyRequirement: 5, cooldownHours: 4, punishment: "Lunch", timezone: tz, challengeRotation: false },
  ...over,
});

test("first to goal: earliest 5th check-in wins the week; misses and pauses don't count", () => {
  const ins: CheckIn[] = [];
  // Week of Sep 14: A finishes Fri 9am, B finishes Thu 6pm (first), C misses.
  for (let d = 0; d < 5; d++) ins.push(ci("A", addDays("2026-09-14", d), 9));
  for (let d = 0; d < 4; d++) ins.push(ci("B", addDays("2026-09-14", d), 18));
  ins.push(ci("B", "2026-09-17", 23)); // B's 5th lands Thu 11pm, before A's Fri 9am
  for (let d = 0; d < 2; d++) ins.push(ci("C", addDays("2026-09-14", d)));
  // Week of Sep 21: everyone finishes; C is fastest (two-a-days early).
  for (let d = 0; d < 5; d++) ins.push(ci("A", addDays("2026-09-21", d), 12));
  for (let d = 0; d < 5; d++) ins.push(ci("B", addDays("2026-09-21", d), 13));
  for (let d = 0; d < 3; d++) ins.push(ci("C", addDays("2026-09-21", d), 6), ci("C", addDays("2026-09-21", d), 20));
  const g = computeGame(data(ins), new Date(midnightIn("2026-09-29", tz).getTime() + 12 * 3600000));
  const f = firstToGoal(g.history, ins, tz);
  assert.equal(f.byWeek["2026-09-14"], "B");
  assert.equal(f.byWeek["2026-09-21"], "C");
  assert.deepEqual(f.wins, { B: 1, C: 1 });
  assert.equal(f.reachedAt["2026-09-14"].C, undefined); // missed
});

test("first to goal: a player's own (lower) goal counts, and an exempt week is skipped", () => {
  const ins: CheckIn[] = [];
  for (let d = 0; d < 5; d++) ins.push(ci("A", addDays("2026-09-14", d), 8));
  for (let d = 0; d < 3; d++) ins.push(ci("B", addDays("2026-09-14", d), 8)); // B's goal is 3: done Wed
  const d = data(ins, { players: players.map((p) => (p.id === "B" ? { ...p, weeklyRequirement: 3 } : p.id === "C" ? { ...p, paused: true } : p)) });
  const g = computeGame(d, new Date(midnightIn("2026-09-22", tz).getTime() + 12 * 3600000));
  const f = firstToGoal(g.history, ins, tz);
  assert.equal(f.byWeek["2026-09-14"], "B");
  assert.equal(f.wins.C, undefined);
});
