// Daily challenges: who's hit today's target, streaks, and the last 7 days.
// Pure — no React, no I/O.
import type { Challenge, ChallengeLog, Player } from "./types.ts";
import { addDays, localDate } from "./week.ts";

export type ChallengeDay = { day: string; total: number; target: number; done: boolean };

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
): ChallengeState[] {
  return challenges
    .filter((c) => !c.archived)
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
        for (let d = t.done ? today : addDays(today, -1); d >= startDay; d = addDays(d, -1)) {
          if (!dayInfo(d).done) break;
          streak++;
        }
        return {
          player,
          today: t.total,
          target: t.target,
          done: t.done,
          remaining: Math.max(0, t.target - t.total),
          streak,
          last7: Array.from({ length: 7 }, (_, i) => dayInfo(addDays(today, i - 6))),
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

      return { challenge, total, daysCompleted, currentStreak: current, bestStreak: best, doneToday: done(today) };
    })
    // Active challenges, plus retired ones this player actually did.
    .filter((s) => !s.challenge.archived || s.total > 0);
}
