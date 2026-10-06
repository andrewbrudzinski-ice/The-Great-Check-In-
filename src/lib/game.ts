// Pure game logic: turns raw players / check-ins / frozen results into
// everything the UI shows. No React, no I/O — easy to test.
import type { AppData, CheckIn, Player, Punishment, WeekResult } from "./types.ts";
import { addDays, dayIndex, localDate, weekEndsAt, weekKey, weekStartOf } from "./week.ts";

export type Status = "safe" | "one" | "close" | "problem";

export type PlayerWeek = {
  player: Player;
  count: number;
  required: number;
  remaining: number;
  completed: boolean;
  status: Status;
  rank: number; // 1-based
  /** When they hit the requirement (ISO), if they did. */
  completedAt: string | null;
  lastCheckIn: CheckIn | null;
  checkedInToday: boolean;
  /** remaining > days left in the week (needs double sessions). */
  needsDoubles: boolean;
  /** Furthest from the goal while someone else is ahead of them. */
  inDanger: boolean;
  /** Joined mid-week: shown on the board, but this week doesn't count. */
  warmup: boolean;
};

export type WeekRow = {
  player: Player;
  count: number;
  requirement: number;
  completed: boolean;
  punishment: string | null;
};

export type WeekSummary = {
  weekStart: string;
  weekEnd: string;
  rows: WeekRow[];
  /** Who missed the goal and dragged everyone into the punishment. */
  culprits: WeekRow[];
  /** Punishment text that applied to this week. */
  punishment: string;
  /** The group punishment owed for this week (null for a clean week). */
  debt: Punishment | null;
  /** True when the result came from a server-frozen record. */
  frozen: boolean;
};

export type PlayerStats = {
  total: number;
  currentWeek: number;
  currentStreak: number;
  bestStreak: number;
  weeksCompleted: number;
  weeksFailed: number;
  /** Weeks where this player's miss put the whole group on the hook. */
  punishmentsCaused: number;
  /** Current streak already counts this (still running) week. */
  streakIncludesThisWeek: boolean;
  /** Weekly counts for finished weeks, oldest first. */
  timeline: { weekStart: string; count: number; requirement: number; completed: boolean }[];
};

export type GameState = {
  today: string;
  weekStart: string;
  weekEnd: string;
  weekEndsAt: Date;
  dayIndex: number;
  /** Days left including today. */
  daysLeft: number;
  standings: PlayerWeek[];
  everyoneSafe: boolean;
  nobodyToday: boolean;
  history: WeekSummary[]; // newest first
  lastFinishedWeek: WeekSummary | null;
  /** Group punishments not yet done, oldest first. */
  owed: WeekSummary[];
  /** Group punishments already done, newest first. */
  paid: WeekSummary[];
  stats: Record<string, PlayerStats>;
  checkInsThisWeek: CheckIn[];
};

export function statusFor(remaining: number): Status {
  if (remaining <= 0) return "safe";
  if (remaining === 1) return "one";
  if (remaining === 2) return "close";
  return "problem";
}

export const STATUS_META: Record<Status, { label: string; color: string; dot: string }> = {
  safe: { label: "SAFE", color: "var(--color-safe)", dot: "🟢" },
  one: { label: "ONE MORE", color: "var(--color-one)", dot: "🟡" },
  close: { label: "GET TO THE GYM", color: "var(--color-close)", dot: "🟠" },
  problem: { label: "YOU HAVE A PROBLEM", color: "var(--color-problem)", dot: "🔴" },
};

function byTime(a: CheckIn, b: CheckIn) {
  return a.checkedInAt.localeCompare(b.checkedInAt);
}

export function computeGame(data: AppData, now: Date = new Date()): GameState {
  const { players, settings, results } = data;
  const tz = settings.timezone;
  const req = settings.weeklyRequirement;
  const checkIns = [...data.checkIns].sort(byTime);

  const today = localDate(now, tz);
  const weekStart = weekStartOf(today);
  const di = dayIndex(today);
  const daysLeft = 7 - di;

  // Bucket check-ins by week
  const byWeek = new Map<string, CheckIn[]>();
  for (const c of checkIns) {
    const k = weekKey(c.checkedInAt, tz);
    const list = byWeek.get(k);
    if (list) list.push(c);
    else byWeek.set(k, [c]);
  }

  // ---- Current week ----------------------------------------------------
  const thisWeek = byWeek.get(weekStart) ?? [];
  const rows = players.map((player) => {
    const mine = thisWeek.filter((c) => c.userId === player.id);
    const count = mine.length;
    const remaining = Math.max(0, req - count);
    const last = mine[mine.length - 1] ?? null;
    return {
      player,
      count,
      required: req,
      remaining,
      completed: count >= req,
      status: statusFor(remaining),
      rank: 0,
      completedAt: count >= req ? mine[req - 1].checkedInAt : null,
      lastCheckIn: last,
      checkedInToday: !!last && localDate(last.checkedInAt, tz) === today,
      needsDoubles: remaining > daysLeft,
      inDanger: false,
      warmup: localDate(player.createdAt, tz) > weekStart,
      // tie-breaker: whoever reached their current count first
      _reachedAt: last?.checkedInAt ?? "9999",
    };
  });

  rows.sort(
    (a, b) =>
      Number(b.completed) - Number(a.completed) ||
      (a.completed && b.completed ? a.completedAt!.localeCompare(b.completedAt!) : 0) ||
      b.count - a.count ||
      a._reachedAt.localeCompare(b._reachedAt) ||
      a.player.name.localeCompare(b.player.name),
  );
  const standings: PlayerWeek[] = rows.map(({ _reachedAt, ...r }, i) => ({ ...r, rank: i + 1 }));
  // Danger = whoever needs the most, but only if someone is actually doing
  // better than them (a three-way tie means nobody is singled out).
  const competing = standings.filter((s) => !s.warmup);
  const short = competing.filter((s) => !s.completed);
  if (short.length) {
    const most = Math.max(...short.map((s) => s.remaining));
    const worst = short.filter((s) => s.remaining === most);
    if (worst.length < competing.length) worst.forEach((s) => (s.inDanger = true));
  }

  // ---- Finished weeks --------------------------------------------------
  const frozenByWeek = new Map<string, WeekResult[]>();
  for (const r of results) {
    const list = frozenByWeek.get(r.weekStart);
    if (list) list.push(r);
    else frozenByWeek.set(r.weekStart, [r]);
  }

  const debtByWeek = new Map(data.punishments.map((p) => [p.weekStart, p]));

  const firstDay = [
    ...players.map((p) => localDate(p.createdAt, tz)),
    ...(checkIns[0] ? [localDate(checkIns[0].checkedInAt, tz)] : []),
    ...results.map((r) => r.weekStart),
  ].sort()[0];

  const history: WeekSummary[] = [];
  if (firstDay) {
    for (let wk = weekStartOf(firstDay); wk < weekStart; wk = addDays(wk, 7)) {
      const frozen = frozenByWeek.get(wk);
      let weekRows: WeekRow[];
      if (frozen) {
        weekRows = frozen
          .map((r) => {
            const player = players.find((p) => p.id === r.userId);
            return player
              ? { player, count: r.count, requirement: r.requirement, completed: r.completed, punishment: r.punishment }
              : null;
          })
          .filter((r): r is WeekRow => r !== null);
      } else {
        // Not frozen yet (server hasn't rolled it over) — compute live.
        const list = byWeek.get(wk) ?? [];
        weekRows = players
          .filter((p) => localDate(p.createdAt, tz) <= wk)
          .map((player) => {
            const count = list.filter((c) => c.userId === player.id).length;
            const completed = count >= req;
            return { player, count, requirement: req, completed, punishment: completed ? null : settings.punishment };
          });
      }
      if (!weekRows.length) continue;
      weekRows.sort((a, b) => Number(b.completed) - Number(a.completed) || b.count - a.count);
      const culprits = weekRows.filter((r) => !r.completed);
      const text = culprits[0]?.punishment ?? frozen?.find((r) => r.punishment)?.punishment ?? settings.punishment;
      // If anyone missed, the group owes it. Weeks the server hasn't rolled
      // over yet get a provisional "owed" record.
      const debt: Punishment | null = culprits.length
        ? (debtByWeek.get(wk) ?? { weekStart: wk, text, status: "owed", completedAt: null, completedBy: null })
        : null;
      history.push({
        weekStart: wk,
        weekEnd: addDays(wk, 6),
        rows: weekRows,
        culprits,
        punishment: debt?.text ?? text,
        debt,
        frozen: !!frozen,
      });
    }
  }
  history.reverse();

  // ---- Per-player stats & streaks --------------------------------------
  const stats: Record<string, PlayerStats> = {};
  const chronological = [...history].reverse();
  for (const p of players) {
    let streak = 0;
    let best = 0;
    let completed = 0;
    let failed = 0;
    const timeline: PlayerStats["timeline"] = [];
    for (const w of chronological) {
      const row = w.rows.find((r) => r.player.id === p.id);
      if (!row) continue; // hadn't joined yet
      timeline.push({ weekStart: w.weekStart, count: row.count, requirement: row.requirement, completed: row.completed });
      if (row.completed) {
        completed++;
        streak++;
        best = Math.max(best, streak);
      } else {
        failed++;
        streak = 0;
      }
    }
    const cur = standings.find((s) => s.player.id === p.id)!;
    const includes = cur.completed && !cur.warmup;
    if (includes) {
      streak++;
      best = Math.max(best, streak);
    }
    stats[p.id] = {
      total: checkIns.filter((c) => c.userId === p.id).length,
      currentWeek: cur.count,
      currentStreak: streak,
      bestStreak: best,
      weeksCompleted: completed,
      weeksFailed: failed,
      punishmentsCaused: failed,
      streakIncludesThisWeek: includes,
      timeline,
    };
  }

  return {
    today,
    weekStart,
    weekEnd: addDays(weekStart, 6),
    weekEndsAt: weekEndsAt(weekStart, tz),
    dayIndex: di,
    daysLeft,
    standings,
    everyoneSafe: competing.length > 0 && competing.every((s) => s.completed),
    nobodyToday: !standings.some((s) => s.checkedInToday),
    history,
    lastFinishedWeek: history[0] && history[0].weekStart === addDays(weekStart, -7) ? history[0] : null,
    owed: history.filter((w) => w.debt?.status === "owed").reverse(),
    paid: history.filter((w) => w.debt?.status === "done"),
    stats,
    checkInsThisWeek: thisWeek,
  };
}

/** Cooldown remaining for a player, in ms (0 = free to check in). */
export function cooldownRemaining(checkIns: CheckIn[], userId: string, hours: number, now: Date = new Date()): number {
  let last = 0;
  for (const c of checkIns) {
    if (c.userId === userId) last = Math.max(last, new Date(c.checkedInAt).getTime());
  }
  if (!last) return 0;
  return Math.max(0, last + hours * 3600000 - now.getTime());
}
