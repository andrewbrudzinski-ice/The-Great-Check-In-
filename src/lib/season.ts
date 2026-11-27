// Season extras worked out from data the club already has. Pure, read-only:
// nothing here changes how weeks are scored.
import type { WeekSummary } from "./game.ts";
import type { CheckIn } from "./types.ts";
import { weekKey } from "./week.ts";

export type FirstToGoal = {
  /** Weeks each player was first to hit their goal. */
  wins: Record<string, number>;
  /** weekStart → the player who got there first. */
  byWeek: Record<string, string>;
  /** weekStart → playerId → when they hit their goal (ISO). */
  reachedAt: Record<string, Record<string, string>>;
};

/**
 * For each finished week: who hit their own goal first. Paused (exempt)
 * players and anyone who missed don't count. If a frozen result says a
 * player completed but their check-ins no longer show it (e.g. one was
 * removed), they're simply left out of that week's race.
 */
export function firstToGoal(history: WeekSummary[], checkIns: CheckIn[], tz: string): FirstToGoal {
  const byWeekUser = new Map<string, Map<string, string[]>>();
  const sorted = [...checkIns].sort((a, b) => Date.parse(a.checkedInAt) - Date.parse(b.checkedInAt));
  for (const c of sorted) {
    const wk = weekKey(c.checkedInAt, tz);
    let users = byWeekUser.get(wk);
    if (!users) byWeekUser.set(wk, (users = new Map()));
    const list = users.get(c.userId);
    if (list) list.push(c.checkedInAt);
    else users.set(c.userId, [c.checkedInAt]);
  }

  const wins: Record<string, number> = {};
  const byWeek: Record<string, string> = {};
  const reachedAt: Record<string, Record<string, string>> = {};
  for (const w of history) {
    let best: { id: string; at: string } | null = null;
    const reached: Record<string, string> = {};
    for (const row of w.rows) {
      if (!row.completed || row.exempt) continue;
      const at = byWeekUser.get(w.weekStart)?.get(row.player.id)?.[row.requirement - 1];
      if (!at) continue;
      reached[row.player.id] = at;
      if (!best || Date.parse(at) < Date.parse(best.at)) best = { id: row.player.id, at };
    }
    reachedAt[w.weekStart] = reached;
    if (best) {
      wins[best.id] = (wins[best.id] ?? 0) + 1;
      byWeek[w.weekStart] = best.id;
    }
  }
  return { wins, byWeek, reachedAt };
}
