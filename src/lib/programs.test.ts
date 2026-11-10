import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRun, PRESETS, programName } from "./programs.ts";
import type { Program, ProgramDay } from "./types.ts";

const tasks = PRESETS[0].tasks.slice(0, 2); // diet, workout1
const all = tasks.map((t) => t.id);
const run = (over: Partial<Program> = {}): Program => ({
  id: "r", userId: "A", name: "75 Hard", strict: true, lengthDays: 75, tasks, startDate: "2026-11-01",
  status: "active", attempt: 1, createdAt: "", endedAt: null, ...over,
});
const day = (d: string, done = all): ProgramDay => ({ programId: "r", day: d, done });

test("day number, today's ticks and yesterday still open", () => {
  const days = [day("2026-11-01"), day("2026-11-02"), day("2026-11-03", ["diet"]), day("2026-11-04", ["diet"])];
  const r = computeRun(run(), days, "2026-11-04");
  assert.equal(r.dayNumber, 4);
  assert.deepEqual(r.doneToday, ["diet"]);
  assert.equal(r.todayComplete, false);
  assert.equal(r.yesterday?.complete, false); // Nov 3 half done but still fixable
  assert.equal(r.failedOn, null);
  assert.deepEqual(r.calendar.slice(0, 5).map((c) => c.state), ["done", "done", "partial-open", "today", "future"]);
});

test("Hard: a locked incomplete day fails the run", () => {
  const days = [day("2026-11-01"), day("2026-11-02", ["diet"]), day("2026-11-03"), day("2026-11-04")];
  const r = computeRun(run(), days, "2026-11-04");
  assert.deepEqual(r.failedOn, { day: "2026-11-02", n: 2 });
  assert.equal(r.completed, false);
});

test("Soft: misses count but don't fail", () => {
  const days = [day("2026-11-01"), day("2026-11-03")];
  const r = computeRun(run({ strict: false, name: "75 Soft" }), days, "2026-11-05");
  assert.equal(r.failedOn, null);
  assert.equal(r.missedDays, 1); // Nov 2 (Nov 4 is yesterday, still open)
  assert.equal(r.completeDays, 2);
});

test("finishing: Hard completes the moment the last day is ticked; Soft once it's over", () => {
  const short = run({ lengthDays: 7 });
  const days = Array.from({ length: 7 }, (_, i) => day(`2026-11-0${i + 1}`));
  const r = computeRun(short, days, "2026-11-07");
  assert.equal(r.completed, true);
  assert.equal(r.finished, true);
  const soft = computeRun({ ...short, strict: false }, days.slice(0, 5), "2026-11-10");
  assert.equal(soft.finished, true);
  assert.equal(soft.completeDays, 5);
});

test("not started yet; names", () => {
  const r = computeRun(run({ startDate: "2026-11-11" }), [], "2026-11-10");
  assert.equal(r.started, false);
  assert.equal(r.dayNumber, 0);
  assert.equal(r.failedOn, null);
  assert.equal(programName(35, false), "35 Soft");
});
