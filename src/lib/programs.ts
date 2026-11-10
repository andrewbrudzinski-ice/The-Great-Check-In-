// 75 Hard / 75 Soft and shorter runs: presets and the day-by-day state of a run.
// Pure — no React, no I/O.
import type { Program, ProgramDay, ProgramTask } from "./types.ts";
import { addDays } from "./week.ts";

export type Preset = { key: "hard" | "soft"; title: string; strict: boolean; blurb: string; tasks: ProgramTask[] };

export const PRESETS: Preset[] = [
  {
    key: "hard",
    title: "Hard",
    strict: true,
    blurb: "Miss anything, start over at Day 1.",
    tasks: [
      { id: "diet", emoji: "🥗", label: "Follow a diet. No cheat meals, no alcohol" },
      { id: "workout1", emoji: "🏋️", label: "45-minute workout" },
      { id: "workout2", emoji: "🌳", label: "Second 45-minute workout, outdoors" },
      { id: "water", emoji: "💧", label: "Drink a gallon of water" },
      { id: "read", emoji: "📖", label: "Read 10 pages of nonfiction" },
      { id: "photo", emoji: "📸", label: "Take a progress photo" },
    ],
  },
  {
    key: "soft",
    title: "Soft",
    strict: false,
    blurb: "Misses count against you, but no reset.",
    tasks: [
      { id: "diet", emoji: "🥗", label: "Eat well. Alcohol only on social occasions" },
      { id: "workout", emoji: "🏋️", label: "45-minute workout (active recovery once a week)" },
      { id: "water", emoji: "💧", label: "Drink 3 liters of water" },
      { id: "read", emoji: "📖", label: "Read 10 pages" },
    ],
  },
];

export const LENGTHS = [30, 35, 75];

export const programName = (length: number, strict: boolean) => `${length} ${strict ? "Hard" : "Soft"}`;

export type CalendarCell = {
  day: string;
  n: number; // Day 1…N
  state: "done" | "missed" | "partial-open" | "today" | "future";
  ticked: number;
};

export type RunState = {
  program: Program;
  /** 1-based day number for today (0 if it hasn't started, length if it's over). */
  dayNumber: number;
  started: boolean;
  doneToday: string[];
  todayComplete: boolean;
  /** Yesterday is still tickable until it ends. */
  yesterday: { day: string; done: string[]; complete: boolean } | null;
  completeDays: number;
  missedDays: number;
  /** Hard rules: the first locked day with something unticked. */
  failedOn: { day: string; n: number } | null;
  /** Ran its full length (and, for Hard, never missed). */
  completed: boolean;
  /** The last day is behind us (locked or fully done). */
  finished: boolean;
  calendar: CalendarCell[];
};

/**
 * Days older than yesterday are locked. Hard: any locked day not fully ticked
 * fails the run. Soft: it just counts as missed.
 */
export function computeRun(program: Program, days: ProgramDay[], today: string): RunState {
  const doneBy = new Map(days.filter((d) => d.programId === program.id).map((d) => [d.day, new Set(d.done)]));
  const ids = program.tasks.map((t) => t.id);
  const complete = (day: string) => ids.every((id) => doneBy.get(day)?.has(id));
  const lastDay = addDays(program.startDate, program.lengthDays - 1);
  const yesterdayDate = addDays(today, -1);

  const calendar: CalendarCell[] = [];
  let completeDays = 0;
  let missedDays = 0;
  let failedOn: RunState["failedOn"] = null;
  for (let i = 0; i < program.lengthDays; i++) {
    const day = addDays(program.startDate, i);
    const ticked = ids.filter((id) => doneBy.get(day)?.has(id)).length;
    let state: CalendarCell["state"];
    if (day > today) state = "future";
    else if (complete(day)) state = "done";
    else if (day === today) state = "today";
    else if (day === yesterdayDate) state = "partial-open";
    else state = "missed";
    if (state === "done") completeDays++;
    if (state === "missed") {
      missedDays++;
      if (program.strict && !failedOn) failedOn = { day, n: i + 1 };
    }
    calendar.push({ day, n: i + 1, state, ticked });
  }

  const started = program.startDate <= today;
  const dayNumber = !started ? 0 : Math.min(program.lengthDays, calendar.findIndex((c) => c.day === today) + 1 || program.lengthDays);
  // Over once the last day is locked, or already fully ticked.
  const finished = lastDay < yesterdayDate || (lastDay <= today && complete(lastDay));
  const allDone = calendar.every((c) => c.state === "done");
  const yesterdayInRun = yesterdayDate >= program.startDate && yesterdayDate <= lastDay;

  return {
    program,
    dayNumber,
    started,
    doneToday: started && today <= lastDay ? [...(doneBy.get(today) ?? [])] : [],
    todayComplete: complete(today),
    yesterday: yesterdayInRun
      ? { day: yesterdayDate, done: [...(doneBy.get(yesterdayDate) ?? [])], complete: complete(yesterdayDate) }
      : null,
    completeDays,
    missedDays,
    failedOn,
    completed: program.strict ? allDone : finished,
    finished: finished || (program.strict && allDone),
    calendar,
  };
}

/** A run's state for display: what to call it right now. */
export function runLabel(r: RunState): string {
  const p = r.program;
  if (p.status === "completed" || (r.completed && r.finished)) return "Completed";
  if (p.status === "failed" || r.failedOn) return `Failed on Day ${r.failedOn?.n ?? "?"}`;
  if (p.status === "quit") return "Quit";
  if (!r.started) return "Starts tomorrow";
  if (r.finished) return `Finished · ${r.completeDays}/${p.lengthDays} days`;
  return `Day ${r.dayNumber} of ${p.lengthDays}`;
}

export type ProgramSummary = {
  active: RunState[];
  past: RunState[];
  attempts: number;
  completed: number;
  failed: number;
  /** Fully ticked days across every run. */
  totalDays: number;
  /** The run with the most completed days. */
  best: { name: string; days: number; length: number } | null;
};

/** One player's 75 Hard / Soft history, for their profile. */
export function programSummary(programs: Program[], days: ProgramDay[], userId: string, today: string): ProgramSummary {
  const runs = programs
    .filter((p) => p.userId === userId)
    .map((p) => computeRun(p, days, today))
    .sort((a, b) => b.program.createdAt.localeCompare(a.program.createdAt));
  const best = runs.reduce<RunState | null>((b, r) => (!b || r.completeDays > b.completeDays ? r : b), null);
  return {
    active: runs.filter((r) => r.program.status === "active"),
    past: runs.filter((r) => r.program.status !== "active"),
    attempts: runs.length,
    completed: runs.filter((r) => r.program.status === "completed").length,
    failed: runs.filter((r) => r.program.status === "failed" || (r.program.status === "active" && r.failedOn)).length,
    totalDays: runs.reduce((n, r) => n + r.completeDays, 0),
    best: best && best.completeDays > 0 ? { name: best.program.name, days: best.completeDays, length: best.program.lengthDays } : null,
  };
}
