import { test } from "node:test";
import assert from "node:assert/strict";
import { computeChallenges, dailyStreaks, lifetimeStats, pickFor, quickAmounts, randomPick } from "./challenges.ts";
import type { Challenge, ChallengeLog, Player } from "./types.ts";

const tz = "America/New_York";
const players: Player[] = ["A", "B"].map((id) => ({ id, name: id, avatar: "x", color: "#fff", isAdmin: false, isOwner: false, createdAt: "2026-10-01T12:00:00Z", weeklyRequirement: null, paused: false }));
const pushups: Challenge = { id: "p", name: "Pushups", emoji: "💪", dailyTarget: 100, unit: "reps", archived: false, createdBy: null, createdAt: "2026-10-20T12:00:00Z", sortOrder: 1 };
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

const mk = (id: string, sortOrder: number, dailyTarget = 100, unit = "reps"): Challenge => ({
  ...pushups, id, name: id, dailyTarget, unit, sortOrder,
});
const pool = [mk("Pushups", 1), mk("Sit-ups", 2), mk("Burpees", 3, 50), mk("Abs", 4, 10, "min")];

test("random pick: never yesterday's when there's a choice, never a retired one", () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let prev: string | undefined;
  const seen = new Map<string, number>();
  for (let i = 0; i < 400; i++) {
    const c = randomPick(pool, prev, rand)!;
    assert.notEqual(c.id, prev);
    seen.set(c.id, (seen.get(c.id) ?? 0) + 1);
    prev = c.id;
  }
  assert.equal(seen.size, 4); // everything comes up
  for (const n of seen.values()) assert.ok(n > 70, `spread too uneven: ${[...seen]}`);
  assert.equal(randomPick([pool[0]], "Pushups")?.id, "Pushups"); // only one: repeats are fine
  assert.equal(randomPick([{ ...pool[0], archived: true }], null), null);
  assert.equal(pickFor([{ day: "2026-11-16", challengeId: "Abs" }], pool, "2026-11-16")?.id, "Abs");
  assert.equal(pickFor([], pool, "2026-11-16"), null);
});

test("random mode: one card for today's pick, streak across different exercises", () => {
  const L = (cid: string, day: string, amount: number, target: number): ChallengeLog =>
    ({ id: String(n++), challengeId: cid, userId: "A", amount, target, day, loggedAt: `${day}T12:00:00Z` });
  const logs = [
    L("Pushups", "2026-11-13", 100, 100), // Fri: Pushups (done)
    L("Sit-ups", "2026-11-14", 100, 100), // Sat: Sit-ups (done)
    L("Burpees", "2026-11-15", 30, 50), L("Burpees", "2026-11-15", 20, 50), // Sun: Burpees (done, 2 sets)
    L("Abs", "2026-11-16", 4, 10), // Mon: Abs in progress
  ];
  const picks = [
    { day: "2026-11-13", challengeId: "Pushups" },
    { day: "2026-11-14", challengeId: "Sit-ups" },
    { day: "2026-11-15", challengeId: "Burpees" },
    { day: "2026-11-16", challengeId: "Abs" },
  ];
  const states = computeChallenges(pool, logs, players, "2026-11-16", tz, { rotation: true, picks });
  assert.equal(states.length, 1);
  assert.equal(states[0].challenge.id, "Abs"); // the saved pick decides
  assert.equal(computeChallenges(pool, logs, players, "2026-11-16", tz, { rotation: true }).length, 0); // not picked yet
  const a = states[0].players.find((p) => p.player.id === "A")!;
  assert.equal(a.streak, 3); // Fri–Sun, each a different exercise; today still open
  assert.deepEqual(a.last7.slice(-4).map((d) => [d.challengeId, d.done]), [["Pushups", true], ["Sit-ups", true], ["Burpees", true], ["Abs", false]]);
  const s = dailyStreaks(pool, logs, "A", "2026-11-16");
  assert.deepEqual([s.current, s.best, s.doneToday], [3, 3, false]);
});

test("each exercise keeps its own totals and best day", () => {
  const L = (cid: string, day: string, amount: number): ChallengeLog =>
    ({ id: String(n++), challengeId: cid, userId: "A", amount, target: 100, day, loggedAt: `${day}T12:00:00Z` });
  const logs = [L("Pushups", "2026-11-01", 60), L("Pushups", "2026-11-01", 60), L("Pushups", "2026-11-05", 100), L("Sit-ups", "2026-11-02", 80)];
  const stats = lifetimeStats(pool, logs, "A", "2026-11-06", tz);
  const by = Object.fromEntries(stats.map((x) => [x.challenge.id, x]));
  assert.equal(by.Pushups.total, 220);
  assert.equal(by.Pushups.bestDay, 120);
  assert.equal(by.Pushups.daysCompleted, 2);
  assert.equal(by["Sit-ups"].total, 80); // sit-ups never count toward pushups
  assert.equal(by["Sit-ups"].daysCompleted, 0);
});
