// The app's mouth. Lines are picked with a seed so they stay put while you
// look at the screen but rotate between sessions/days.
import type { PlayerWeek } from "./game.ts";
import { DAY_LONG } from "./week.ts";

type Vars = { name: string; n: number; count: number; req: number; day: string; days: number };

const POOLS = {
  zero: [
    "Not a single check-in. Incredible.",
    "{name} has 0 check-ins. The gym misses you. Probably.",
    "Zero. Zilch. The treadmill doesn't know your name.",
    "It's {day}. {name} has yet to be spotted.",
  ],
  problem: [
    "Brother, the gym isn't going to visit you.",
    "It's {day}. You have {count}. Figure it out.",
    "{name} needs {n} more. Clock's ticking.",
    "{name} has some explaining to do.",
    "{n} to go. Hope you like lunch bills.",
  ],
  doubles: [
    "{n} needed, {days} {daysWord} left. Two-a-days, champ.",
    "Mathematically alive. Barely. {n} in {days} {daysWord}.",
    "{name} needs doubles. Good luck with that.",
  ],
  pace: [
    "On pace. For now.",
    "{n} to go, {days} days to do it. Plenty of time to blow it.",
    "On schedule. Don't get comfortable.",
    "{name} is on pace. Suspicious.",
  ],
  close: [
    "{name} needs {n} more check-ins.",
    "Two more. Don't make it weird.",
    "{n} to go. Totally doable. Probably.",
    "Halfway decent. Emphasis on halfway.",
  ],
  one: [
    "1 more to go.",
    "One. More. Check-in.",
    "So close you can taste the protein shake.",
    "{name} is one session from safety.",
  ],
  safe: [
    "SAFE. You may now relax.",
    "{name} is safe. Unfortunately.",
    "Done for the week. Insufferable about it, too.",
    "Requirement met. Smugness unlocked.",
  ],
  overachiever: [
    "Overachiever.",
    "{count} check-ins. We get it.",
    "Safe since {day}. Show-off.",
    "Extra credit doesn't exist here, but sure.",
  ],
  successLine: [
    "Another one in the books.",
    "Your future self thanks you.",
    "Logged. Witnessed. Undeniable.",
    "The streak gods are pleased.",
    "That's how it's done.",
    "Receipts filed.",
  ],
  safeLine: [
    "Requirement met. Sleep well tonight.",
    "SAFE. The rest is a victory lap.",
    "You're off the hook this week.",
  ],
  fail: [
    "Congratulations. You played yourself.",
    "The receipts don't lie.",
    "History will remember this.",
    "Pay up. With dignity, if possible.",
  ],
  quiet: [
    "The gym is suspiciously quiet.",
    "Nobody's checked in today. Bold strategy.",
    "Zero check-ins today. The weights are getting lonely.",
  ],
  everyoneSafe: [
    "EVERYONE IS SAFE.",
    "Nobody's buying lunch this week. Disappointing.",
    "Full squad secured. Who even are you people?",
  ],
} as const;

export type Pool = keyof typeof POOLS;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Per-load salt so lines rotate between visits but don't flicker on re-render. */
const SESSION_SALT = Math.floor(Math.random() * 1e9).toString(36);

export function line(pool: Pool, seed: string, vars: Partial<Vars> = {}): string {
  // Second-person copy ("You needs 2 more") reads wrong, so skip named lines.
  const all: readonly string[] = POOLS[pool];
  const unnamed = all.filter((t) => !t.includes("{name}"));
  const options = vars.name === "You" && unnamed.length ? unnamed : all;
  const tpl = options[hash(seed + SESSION_SALT) % options.length];
  return fill(tpl, vars);
}

function fill(tpl: string, v: Partial<Vars>) {
  return tpl
    .replaceAll("{name}", v.name ?? "")
    .replaceAll("{n}", String(v.n ?? ""))
    .replaceAll("{count}", String(v.count ?? ""))
    .replaceAll("{req}", String(v.req ?? ""))
    .replaceAll("{day}", v.day ?? "")
    .replaceAll("{days}", String(v.days ?? ""))
    .replaceAll("{daysWord}", v.days === 1 ? "day" : "days");
}

/** The one-liner for a player's current week. */
export function playerLine(pw: PlayerWeek, ctx: { weekStart: string; dayIndex: number; daysLeft: number }, firstPerson = false): string {
  const vars: Vars = {
    name: firstPerson ? "You" : pw.player.name,
    n: pw.remaining,
    count: pw.count,
    req: pw.required,
    day: DAY_LONG[ctx.dayIndex],
    days: ctx.daysLeft,
  };
  const seed = pw.player.id + ctx.weekStart + pw.count + (firstPerson ? "you" : "");
  if (pw.completed) {
    if (pw.count > pw.required || ctx.daysLeft >= 3) {
      return line("overachiever", seed, { ...vars, day: completedDay(pw) });
    }
    return line("safe", seed, vars);
  }
  if (pw.count === 0) return line("zero", seed, vars);
  if (pw.needsDoubles) return line("doubles", seed, vars);
  // Early in the week a low count is fine as long as there are spare days.
  if (pw.status === "problem" && pw.remaining <= ctx.daysLeft - 2) return line("pace", seed, vars);
  return line(pw.status === "one" ? "one" : pw.status === "close" ? "close" : "problem", seed, vars);
}

function completedDay(pw: PlayerWeek) {
  if (!pw.completedAt) return "forever";
  const d = new Date(pw.completedAt).getDay();
  return DAY_LONG[(d + 6) % 7];
}

/** "Who's in trouble" headline for one player — third person, a bit meaner. */
export function troubleLine(pw: PlayerWeek, ctx: { weekStart: string; dayIndex: number; daysLeft: number }): string {
  const name = pw.player.name;
  const seed = "t" + pw.player.id + ctx.weekStart + pw.count;
  const pick = (opts: string[]) => opts[hash(seed + SESSION_SALT) % opts.length];
  const n = pw.remaining;
  const s = n === 1 ? "" : "s";
  switch (pw.status) {
    case "safe":
      return pick([`${name} is safe. Unfortunately.`, `${name} is done. Unbearable about it.`, `${name} has clocked out for the week.`]);
    case "one":
      return pick([`${name} is one check-in from freedom.`, `${name} needs 1 more. Don't choke.`, `${name} can smell safety.`]);
    case "close":
      return pick([`${name} needs ${n} more check-ins.`, `${name} is ${n} away. Sweating, hopefully.`, `${name} should be packing a gym bag right now.`]);
    default:
      if (pw.count === 0) return pick([`${name} has some explaining to do.`, `Has anyone heard from ${name}?`, `${name}: 0 check-ins. Incredible work.`]);
      if (!pw.needsDoubles && n <= ctx.daysLeft - 2)
        return pick([`${name} is on pace. For now.`, `${name} needs ${n} more. Time's on their side. For now.`, `${name} has ${n} to go and no excuses.`]);
      if (pw.needsDoubles) return pick([`${name} needs ${n} in ${ctx.daysLeft} day${ctx.daysLeft === 1 ? "" : "s"}. Start stretching.`, `${name} is in two-a-day territory.`]);
      return pick([`${name} needs ${n} more check-in${s}. Yikes.`, `${name} has some explaining to do.`, `${name} is speedrunning a punishment.`]);
  }
}

/** "A", "A & B", "A, B & C" */
export function joinNames(names: string[]): string {
  return names.length <= 2 ? names.join(" & ") : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}
