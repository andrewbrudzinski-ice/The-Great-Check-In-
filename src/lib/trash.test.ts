import { test } from "node:test";
import assert from "node:assert/strict";
import { computeGame } from "./game.ts";
import { playerLine, playerLines, troubleLines } from "./trash.ts";
import type { AppData, CheckIn, Player } from "./types.ts";
import { midnightIn } from "./week.ts";

const tz = "America/New_York";
const names = ["Andrew", "Mike", "John", "Chuck"];
const players: Player[] = names.map((n) => ({
  id: n, name: n, avatar: "💪", color: "#fff", isAdmin: false, isOwner: false,
  createdAt: "2026-09-01T12:00:00Z", weeklyRequirement: null, paused: false,
}));
const ci = (userId: string, day: string, hour = 12): CheckIn => ({
  id: `${userId}-${day}-${hour}`, userId, latitude: 0, longitude: 0, accuracy: 5, distanceM: 1, radiusM: 150,
  gymId: "g", gymName: "Gym", checkedInAt: new Date(midnightIn(day, tz).getTime() + hour * 3600000).toISOString(),
} as CheckIn);

function game(checkIns: CheckIn[], day: string) {
  const data = {
    players, checkIns, results: [], punishments: [], gyms: [], challenges: [], challengeLogs: [], challengePicks: [],
    programs: [], programDays: [], messages: [], reactions: [],
    settings: { appTitle: "", appSubtitle: "", checkInRadius: 150, weeklyRequirement: 5, cooldownHours: 4, punishment: "Lunch", timezone: tz, challengeRotation: false },
  } as AppData;
  const g = computeGame(data, new Date(midnightIn(day, tz).getTime() + 15 * 3600000));
  return { g, ctx: { weekStart: g.weekStart, dayIndex: g.dayIndex, daysLeft: g.daysLeft } };
}

// Same wording regardless of whose name is in it.
const shape = (text: string) => names.reduce((t, n) => t.replaceAll(n, "{name}"), text);

test("everyone on the board gets a different line, even in the same spot", () => {
  // Thursday, all four on 2/5: the same pool for everyone.
  const ins = names.flatMap((n) => [ci(n, "2026-10-05"), ci(n, "2026-10-06")]);
  for (const day of ["2026-10-08", "2026-10-09"]) {
    const { g, ctx } = game(ins, day);
    const lines = [...playerLines(g.standings, ctx).values()];
    assert.equal(lines.length, 4);
    assert.equal(new Set(lines.map(shape)).size, 4, lines.join(" | "));
    const trouble = [...troubleLines(g.standings, ctx).values()];
    assert.equal(new Set(trouble.map(shape)).size, Math.min(4, 3), trouble.join(" | ")); // these pools hold 3 lines
  }
});

test("names still fill in", () => {
  const { g, ctx } = game([], "2026-10-06");
  const lines = playerLines(g.standings, ctx);
  for (const [, text] of lines) assert.ok(!text.includes("{"), text);
});

test("your line at the top of Home never repeats your line on the race board", () => {
  // Wednesday, Andrew on 4/5 ("one more"): the pool where the clash showed up. Try many weeks.
  for (let w = 0; w < 30; w++) {
    const monday = new Date(Date.UTC(2026, 8, 7 + w * 7)).toISOString().slice(0, 10);
    const day = (d: number) => new Date(Date.parse(monday) + d * 86400000).toISOString().slice(0, 10);
    const ins = [0, 1, 2].flatMap((d) => [ci("Andrew", day(d), 7), ci("Andrew", day(d), 19)]).slice(0, 4);
    for (const n of ["Mike", "John", "Chuck"]) ins.push(ci(n, day(0)));
    const { g, ctx } = game(ins, day(2));
    const me = g.standings.find((pw) => pw.player.id === "Andrew")!;
    const board = playerLines(g.standings, ctx).get("Andrew")!;
    const hero = playerLine(me, ctx, true, g.standings);
    assert.notEqual(hero, board, `week of ${monday}`);
  }
});
