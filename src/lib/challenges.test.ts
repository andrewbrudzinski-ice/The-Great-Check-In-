import { test } from "node:test";
import assert from "node:assert/strict";
import { computeChallenges, lifetimeStats, quickAmounts } from "./challenges.ts";
import type { Challenge, ChallengeLog, Player } from "./types.ts";

const tz = "America/New_York";
const players: Player[] = ["A", "B"].map((id) => ({ id, name: id, avatar: "x", color: "#fff", isAdmin: false, createdAt: "2026-10-01T12:00:00Z" }));
const pushups: Challenge = { id: "p", name: "Pushups", emoji: "💪", dailyTarget: 100, unit: "reps", archived: false, createdBy: null, createdAt: "2026-10-20T12:00:00Z" };
let n = 0;
const log = (userId: string, day: string, amount: number, target = 100): ChallengeLog =>
  ({ id: String(n++), challengeId: "p", userId, amount, target, day, loggedAt: `${day}T1${n % 10}:00:00Z` });

test("today's totals, done and remaining", () => {
  const s = computeChallenges([pushups], [log("A", "2026-11-01", 60), log("A", "2026-11-01", 50), log("B", "2026-11-01", 30)], players, "2026-11-01", tz)[0];
  assert.deepEqual(s.players.map((p) => [p.player.id, p.today, p.done, p.remaining]), [["A", 110, true, 0], ["B", 30, false, 70]]);
  assert.equal(s.doneCount, 1);
  assert.equal(s.everyoneDone, false);
  assert.equal(s.players[0].logsToday.length, 2);
});

test("streaks count back from today, or from yesterday while today is in progress", () => {
  const logs = [
    log("A", "2026-10-29", 100), log("A", "2026-10-30", 100), log("A", "2026-10-31", 100), log("A", "2026-11-01", 20),
    log("B", "2026-10-30", 100), log("B", "2026-10-31", 99), log("B", "2026-11-01", 100),
  ];
  const s = computeChallenges([pushups], logs, players, "2026-11-01", tz)[0];
  const by = Object.fromEntries(s.players.map((p) => [p.player.id, p]));
  assert.equal(by.A.streak, 3); // today not done yet → streak still alive from yesterday
  assert.equal(by.B.streak, 1); // 99 on Oct 31 broke it
  assert.deepEqual(by.A.last7.map((d) => d.done), [false, false, false, true, true, true, false]);
});

test("past days keep the target that applied then", () => {
  const raised = { ...pushups, dailyTarget: 150 };
  const s = computeChallenges([raised], [log("A", "2026-10-31", 100, 100), log("A", "2026-11-01", 100, 150)], players, "2026-11-01", tz)[0];
  const a = s.players.find((p) => p.player.id === "A")!;
  assert.equal(a.last7[5].done, true); // yesterday: 100 of 100
  assert.equal(a.done, false); // today: 100 of 150
  assert.equal(a.streak, 1);
});

test("archived challenges are hidden; quick amounts scale", () => {
  assert.equal(computeChallenges([{ ...pushups, archived: true }], [], players, "2026-11-01", tz).length, 0);
  assert.deepEqual(quickAmounts(100), [10, 25, 50]);
  assert.deepEqual(quickAmounts(5), [1, 2, 5]);
  assert.deepEqual(quickAmounts(10000), [500, 1000, 2500]);
});

test("lifetime stats for a profile", () => {
  const logs = [
    log("A", "2026-10-25", 100), log("A", "2026-10-26", 100), log("A", "2026-10-27", 100), // 3 in a row
    log("A", "2026-10-28", 40),                                                          // miss
    log("A", "2026-10-30", 60), log("A", "2026-10-30", 50), log("A", "2026-10-31", 100), // 2 in a row
    log("A", "2026-11-01", 30),                                                          // today, in progress
    log("B", "2026-11-01", 500),
  ];
  const [s] = lifetimeStats([pushups], logs, "A", "2026-11-01", tz);
  assert.equal(s.total, 580);
  assert.equal(s.daysCompleted, 5);
  assert.equal(s.currentStreak, 2); // still alive from yesterday
  assert.equal(s.bestStreak, 3);
  assert.equal(s.doneToday, false);
  // retired challenges only show if the player did any
  const retired = { ...pushups, id: "r", archived: true };
  assert.equal(lifetimeStats([retired], [], "A", "2026-11-01", tz).length, 0);
});
