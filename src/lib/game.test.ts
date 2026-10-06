import { test } from "node:test";
import assert from "node:assert/strict";
import { computeGame, statusFor } from "./game.ts";
import { addDays, localDate, midnightIn, weekKey, weekStartOf, isoWeekNumber, weekRangeLabel } from "./week.ts";
import type { AppData, CheckIn, Player } from "./types.ts";

const tz = "America/New_York";

test("week math", () => {
  assert.equal(weekStartOf("2026-10-06"), "2026-10-05"); // Tue → Mon
  assert.equal(weekStartOf("2026-10-11"), "2026-10-05"); // Sun → Mon
  assert.equal(weekStartOf("2026-10-12"), "2026-10-12");
  // 02:00 UTC Monday is still Sunday evening in New York
  assert.equal(weekKey("2026-10-12T02:00:00Z", tz), "2026-10-05");
  assert.equal(midnightIn("2026-10-12", tz).toISOString(), "2026-10-12T04:00:00.000Z");
  // DST end (Nov 1 2026): midnight is EST afterwards
  assert.equal(midnightIn("2026-11-02", tz).toISOString(), "2026-11-02T05:00:00.000Z");
  assert.equal(isoWeekNumber("2026-10-05"), 41);
  assert.equal(weekRangeLabel("2026-09-28"), "Sep 28 – Oct 4");
  assert.equal(weekRangeLabel("2026-10-05"), "Oct 5 – 11");
});

test("status thresholds", () => {
  assert.deepEqual([0, 1, 2, 3, 5].map(statusFor), ["safe", "one", "close", "problem", "problem"]);
});

const players: Player[] = ["A", "B", "C"].map((n, i) => ({
  id: n, name: n, avatar: "💪", color: "#fff", isAdmin: i === 0, createdAt: "2026-09-14T12:00:00Z",
}));

function ci(userId: string, date: string, hour = 12): CheckIn {
  const t = new Date(midnightIn(date, tz).getTime() + hour * 3600000).toISOString();
  return { id: userId + t, userId, latitude: 0, longitude: 0, accuracy: 5, distanceM: 1, gymName: "G", checkedInAt: t };
}

function data(checkIns: CheckIn[]): AppData {
  return {
    players, checkIns, results: [],
    settings: {
      appTitle: "", appSubtitle: "", gymName: "G", gymLatitude: 0, gymLongitude: 0, checkInRadius: 150,
      weeklyRequirement: 5, cooldownHours: 4, punishment: "Lunch", timezone: tz,
    },
  };
}

test("standings, danger, history, streaks", () => {
  const ins: CheckIn[] = [];
  // Week of Sep 14 & 21 & 28: A completes all, B completes 2 then fails, C fails first
  for (const wk of ["2026-09-14", "2026-09-21", "2026-09-28"]) {
    for (let d = 0; d < 5; d++) ins.push(ci("A", addDays(wk, d)));
  }
  for (const wk of ["2026-09-14", "2026-09-21"]) for (let d = 0; d < 6; d++) ins.push(ci("B", addDays(wk, d)));
  for (let d = 0; d < 3; d++) ins.push(ci("B", addDays("2026-09-28", d)));
  for (let d = 0; d < 2; d++) ins.push(ci("C", addDays("2026-09-14", d)));
  for (const wk of ["2026-09-21", "2026-09-28"]) for (let d = 0; d < 5; d++) ins.push(ci("C", addDays(wk, d)));
  // Current week (Oct 5): A 2, B 4, C 0
  ins.push(ci("A", "2026-10-05", 7), ci("A", "2026-10-06", 7));
  for (let h = 0; h < 4; h++) ins.push(ci("B", "2026-10-05", 6 + h * 4));

  const now = new Date(midnightIn("2026-10-06", tz).getTime() + 15 * 3600000);
  const g = computeGame(data(ins), now);
  assert.equal(g.weekStart, "2026-10-05");
  assert.equal(g.daysLeft, 6);
  assert.deepEqual(g.standings.map((s) => [s.player.id, s.count, s.status]), [
    ["B", 4, "one"], ["A", 2, "problem"], ["C", 0, "problem"],
  ]);
  assert.equal(g.standings.find((s) => s.inDanger)?.player.id, "C");
  assert.equal(g.standings.find((s) => s.player.id === "A")!.checkedInToday, true);

  assert.equal(g.history.length, 3);
  assert.equal(g.history[0].weekStart, "2026-09-28");
  assert.deepEqual(g.history[0].losers.map((l) => l.player.id), ["B"]);
  assert.equal(g.lastFinishedWeek?.weekStart, "2026-09-28");
  assert.equal(g.stats.A.currentStreak, 3);
  assert.equal(g.stats.B.currentStreak, 0);
  assert.equal(g.stats.B.bestStreak, 2);
  assert.equal(g.stats.C.currentStreak, 2);
  assert.equal(g.stats.C.punishments, 1);
  assert.equal(g.stats.A.total, 17);
});

test("frozen results win over live recompute", () => {
  const d = data([ci("A", "2026-09-28")]);
  d.results = players.map((p) => ({
    weekStart: "2026-09-28", userId: p.id, count: p.id === "A" ? 1 : 5, requirement: 5,
    completed: p.id !== "A", punishment: p.id === "A" ? "Old punishment" : null,
  }));
  const g = computeGame(d, new Date("2026-10-06T15:00:00Z"));
  const w = g.history.find((h) => h.weekStart === "2026-09-28")!;
  assert.equal(w.frozen, true);
  assert.equal(w.punishment, "Old punishment");
  assert.deepEqual(w.losers.map((l) => l.player.id), ["A"]);
});

test("completing the requirement ranks first and extends streak live", () => {
  const ins: CheckIn[] = [];
  for (let h = 0; h < 5; h++) ins.push(ci("C", "2026-10-05", 1 + h * 4));
  for (let h = 0; h < 6; h++) ins.push(ci("A", "2026-10-06", 0 + h * 2));
  const g = computeGame(data(ins), new Date("2026-10-07T03:00:00Z"));
  assert.deepEqual(g.standings.map((s) => s.player.id), ["C", "A", "B"]); // C reached 5 first
  assert.equal(g.stats.C.streakIncludesThisWeek, true);
  assert.deepEqual(g.standings.filter((s) => s.inDanger).map((s) => s.player.id), ["B"]);
});

test("nobody is singled out in a full tie", () => {
  const g = computeGame(data([ci("A", "2026-10-05"), ci("B", "2026-10-05"), ci("C", "2026-10-05")]), new Date("2026-10-06T15:00:00Z"));
  assert.equal(g.standings.some((s) => s.inDanger), false);
  assert.equal(localDate(g.weekEndsAt, tz), "2026-10-12");
});

test("joining mid-week is a warm-up", () => {
  const d = data([ci("A", "2026-10-05")]);
  d.players = [...players, { id: "D", name: "D", avatar: "x", color: "#fff", isAdmin: false, createdAt: "2026-09-24T12:00:00Z" }];
  const g = computeGame(d, new Date("2026-10-06T15:00:00Z"));
  const w21 = g.history.find((h) => h.weekStart === "2026-09-21")!;
  assert.equal(w21.rows.some((r) => r.player.id === "D"), false); // joined Thursday
  const w28 = g.history.find((h) => h.weekStart === "2026-09-28")!;
  assert.equal(w28.rows.some((r) => r.player.id === "D"), true);
  const fresh = computeGame({ ...d, players: [...d.players, { ...d.players[3], id: "E", createdAt: "2026-10-06T12:00:00Z" }] }, new Date("2026-10-06T15:00:00Z"));
  assert.equal(fresh.standings.find((s) => s.player.id === "E")!.warmup, true);
  assert.equal(fresh.standings.find((s) => s.player.id === "E")!.inDanger, false);
});
