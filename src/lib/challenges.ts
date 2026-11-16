// Daily challenges: who's hit today's target, streaks, and the last 7 days.
// Pure — no React, no I/O.
import type { Challenge, ChallengeLog, Player } from "./types.ts";
import { addDays, localDate } from "./week.ts";

export type ChallengeDay = {
  day: string;
  total: number;
  target: number;
  done: boolean;
  /** Rotation mode: which challenge that day was (or would have been). */
  challengeId?: string;
};

// ---- Rotation ---------------------------------------------------------------
// One challenge a day for everyone, cycling through active challenges in
// sort order. On anchor.day the rotation sits at anchor.index, then moves one
// a day. Must match rotation_challenge_for() in the database.

export type RotationAnchor = { day: string; index: number };
export const DEFAULT_ANCHOR: RotationAnchor = { day: "2024-01-01", index: 0 };
export const anchorOf = (s: { rotationAnchorDay: string; rotationAnchorIndex: number }): RotationAnchor => ({
  day: s.rotationAnchorDay,
  index: s.rotationAnchorIndex,
});

const utcDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Active challenges in rotation order. */
export function sortedChallenges(challenges: Challenge[]): Challenge[] {
  return challenges
    .filter((c) => !c.archived)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** The challenge on the rotation for a given day (YYYY-MM-DD). */
export function rotationFor(challenges: Challenge[], day: string, anchor: RotationAnchor = DEFAULT_ANCHOR): Challenge | null {
  const pool = sortedChallenges(challenges);
  if (!pool.length) return null;
  const n = anchor.index + Math.round((utcDay(day) - utcDay(anchor.day)) / 86400000);
  return pool[((n % pool.length) + pool.length) % pool.length];
}

/**
 * The anchor that keeps `today`'s challenge in place after the list changes
 * (`before` → `after`). If today's was retired, whatever takes its slot runs today.
 */
export function repinAnchor(before: Challenge[], after: Challenge[], today: string, anchor: RotationAnchor): RotationAnchor {
  const keep = rotationFor(before, today, anchor);
  const oldPos = keep ? sortedChallenges(before).findIndex((c) => c.id === keep.id) : 0;
  const newPos = keep ? sortedChallenges(after).findIndex((c) => c.id === keep.id) : -1;
  return { day: today, index: newPos >= 0 ? newPos : Math.max(0, oldPos) };
}

/** The next `count` days of the rotation, starting with `from`. */
export function rotationSchedule(challenges: Challenge[], from: string, count: number, anchor: RotationAnchor = DEFAULT_ANCHOR) {
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(from, i);
    return { day, challenge: rotationFor(challenges, day, anchor) };
  }).filter((x): x is { day: string; challenge: Challenge } => !!x.challenge);
}

/**
 * Did a player finish "the daily challenge" on a day? In rotation mode that's
 * whichever challenge they logged (normally the day's one). Today is judged
 * against the current target; past days against the target logged then.
 */
function dailyDays(challenges: Challenge[], logs: ChallengeLog[], userId: string, today: string) {
  const byId = new Map(challenges.map((c) => [c.id, c]));
  const byDay = new Map<string, Map<string, { total: number; target: number }>>();
  for (const l of logs) {
    if (l.userId !== userId) continue;
    const day = byDay.get(l.day) ?? new Map();
    const d = day.get(l.challengeId) ?? { total: 0, target: 0 };
    d.total += l.amount;
    d.target = Math.max(d.target, l.target);
    day.set(l.challengeId, d);
    byDay.set(l.day, day);
  }
  return (day: string, expected?: Challenge | null): ChallengeDay => {
    const entries = [...(byDay.get(day)?.entries() ?? [])].map(([cid, d]) => {
      const c = byId.get(cid);
      const target = day === today && c && !c.archived ? c.dailyTarget : d.target || c?.dailyTarget || 1;
      return { cid, total: d.total, target, done: d.total >= target };
    });
    const best = entries.find((e) => e.done) ?? entries.sort((a, b) => b.total / b.target - a.total / a.target)[0];
    if (best) return { day, total: best.total, target: best.target, done: best.done, challengeId: best.cid };
    return { day, total: 0, target: expected?.dailyTarget ?? 0, done: false, challengeId: expected?.id };
  };
}

/** Current and best run of consecutive days with the daily challenge done. */
export function dailyStreaks(challenges: Challenge[], logs: ChallengeLog[], userId: string, today: string) {
  const info = dailyDays(challenges, logs, userId, today);
  const days = [...new Set(logs.filter((l) => l.userId === userId).map((l) => l.day))].sort();
  let current = 0;
  for (let d = info(today).done ? today : addDays(today, -1); days.length && d >= days[0]; d = addDays(d, -1)) {
    if (!info(d).done) break;
    current++;
  }
  let best = 0;
  let run = 0;
  if (days.length) {
    for (let d = days[0]; d <= today; d = addDays(d, 1)) {
      run = info(d).done ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }
  return { current, best, doneToday: info(today).done };
}

export type PlayerChallenge = {
  player: Player;
  today: number;
  target: number;
  done: boolean;
  remaining: number;
  /** Consecutive days hitting the target, ending today (or yesterday if today isn't done yet). */
  streak: number;
  /** Oldest → newest, ending today. */
  last7: ChallengeDay[];
  /** This player's sets today, newest first. */
  logsToday: ChallengeLog[];
};

export type ChallengeState = {
  challenge: Challenge;
  players: PlayerChallenge[];
  everyoneDone: boolean;
  doneCount: number;
};

export function computeChallenges(
  challenges: Challenge[],
  logs: ChallengeLog[],
  players: Player[],
  today: string,
  tz: string,
  opts: { rotation?: boolean; anchor?: RotationAnchor } = {},
): ChallengeState[] {
  const active = opts.rotation ? [rotationFor(challenges, today, opts.anchor)].filter((c): c is Challenge => !!c) : sortedChallenges(challenges);
  return active
    .map((challenge) => {
      const mine = logs.filter((l) => l.challengeId === challenge.id);
      const startDay = localDate(challenge.createdAt, tz);

      const rows = players.map((player) => {
        const byDay = new Map<string, { total: number; target: number; logs: ChallengeLog[] }>();
        for (const l of mine) {
          if (l.userId !== player.id) continue;
          const d = byDay.get(l.day) ?? { total: 0, target: 0, logs: [] };
          d.total += l.amount;
          d.target = Math.max(d.target, l.target); // target in force that day
          d.logs.push(l);
          byDay.set(l.day, d);
        }
        const dayInfo = (day: string): ChallengeDay => {
          const d = byDay.get(day);
          // Today is judged against the current target; past days against what applied then.
          const target = day === today ? challenge.dailyTarget : (d?.target || challenge.dailyTarget);
          const total = d?.total ?? 0;
          return { day, total, target, done: total >= target };
        };

        const t = dayInfo(today);
        let streak = 0;
        let last7: ChallengeDay[];
        if (opts.rotation) {
          // Rotation: the streak and grid follow "the day's challenge", whatever it was.
          streak = dailyStreaks(challenges, logs, player.id, today).current;
          const daily = dailyDays(challenges, logs, player.id, today);
          last7 = Array.from({ length: 7 }, (_, i) => {
            const day = addDays(today, i - 6);
            return daily(day, rotationFor(challenges, day, opts.anchor));
          });
        } else {
          for (let d = t.done ? today : addDays(today, -1); d >= startDay; d = addDays(d, -1)) {
            if (!dayInfo(d).done) break;
            streak++;
          }
          last7 = Array.from({ length: 7 }, (_, i) => dayInfo(addDays(today, i - 6)));
        }
        return {
          player,
          today: t.total,
          target: t.target,
          done: t.done,
          remaining: Math.max(0, t.target - t.total),
          streak,
          last7,
          logsToday: (byDay.get(today)?.logs ?? []).slice().sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)),
        };
      });

      // Done first, then whoever's closest.
      rows.sort((a, b) => Number(b.done) - Number(a.done) || b.today / b.target - a.today / a.target);
      const doneCount = rows.filter((r) => r.done).length;
      return { challenge, players: rows, everyoneDone: rows.length > 0 && doneCount === rows.length, doneCount };
    });
}

/** Sensible quick-add buttons for a target: 100 reps → 10/25/50, 5 min → 1/2/5. */
export function quickAmounts(target: number): number[] {
  if (target <= 5) return [1, 2, 5].filter((n) => n <= Math.max(target, 1) * 2);
  if (target <= 20) return [1, 5, 10];
  if (target <= 60) return [5, 10, 20];
  if (target <= 200) return [10, 25, 50];
  if (target <= 1000) return [50, 100, 250];
  return [500, 1000, 2500];
}

export type ChallengeLifetime = {
  challenge: Challenge;
  /** Everything logged, ever (e.g. total pushups). */
  total: number;
  /** Days the target was hit. */
  daysCompleted: number;
  /** Consecutive days ending today (or yesterday while today is in progress). */
  currentStreak: number;
  bestStreak: number;
  doneToday: boolean;
  /** Most done in a single day. */
  bestDay: number;
};

/** One player's lifetime stats per challenge, for their profile. */
export function lifetimeStats(
  challenges: Challenge[],
  logs: ChallengeLog[],
  playerId: string,
  today: string,
  tz: string,
): ChallengeLifetime[] {
  return challenges
    .map((challenge) => {
      const byDay = new Map<string, { total: number; target: number }>();
      let total = 0;
      for (const l of logs) {
        if (l.challengeId !== challenge.id || l.userId !== playerId) continue;
        total += l.amount;
        const d = byDay.get(l.day) ?? { total: 0, target: 0 };
        d.total += l.amount;
        d.target = Math.max(d.target, l.target);
        byDay.set(l.day, d);
      }
      const done = (day: string) => {
        const d = byDay.get(day);
        if (!d) return false;
        const target = day === today && !challenge.archived ? challenge.dailyTarget : d.target || challenge.dailyTarget;
        return d.total >= target;
      };

      const daysCompleted = [...byDay.keys()].filter(done).length;

      // Best streak: walk every day from the first log to today.
      let best = 0;
      let run = 0;
      const days = [...byDay.keys()].sort();
      if (days.length) {
        for (let d = days[0]; d <= today; d = addDays(d, 1)) {
          run = done(d) ? run + 1 : 0;
          best = Math.max(best, run);
        }
      }

      let current = 0;
      const start = localDate(challenge.createdAt, tz) < (days[0] ?? today) ? localDate(challenge.createdAt, tz) : (days[0] ?? today);
      for (let d = done(today) ? today : addDays(today, -1); d >= start; d = addDays(d, -1)) {
        if (!done(d)) break;
        current++;
      }

      const bestDay = Math.max(0, ...[...byDay.values()].map((d) => d.total));
      return { challenge, total, daysCompleted, currentStreak: current, bestStreak: best, doneToday: done(today), bestDay };
    })
    // Active challenges, plus retired ones this player actually did.
    .filter((s) => !s.challenge.archived || s.total > 0);
}
