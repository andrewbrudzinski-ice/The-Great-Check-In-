"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ChevronLeft, HistoryIcon } from "@/components/Icons";
import { WeekReveal } from "@/components/WeekReveal";
import type { WeekSummary } from "@/lib/game";
import { firstToGoal } from "@/lib/season";
import { useGame } from "@/lib/store";
import { joinNames } from "@/lib/trash";
import { DAY_SHORT, dayIndex, formatTime, localDate, longDate, weekRangeLabel } from "@/lib/week";

export default function HistoryPage() {
  const { data, game } = useGame();
  const tz = data.settings.timezone;
  const [replay, setReplay] = useState<WeekSummary | null>(null);
  const weeks = game.history;
  const season = useMemo(() => firstToGoal(weeks, data.checkIns, tz), [weeks, data.checkIns, tz]);

  const totals = {
    weeks: weeks.length,
    clean: weeks.filter((w) => !w.debt).length,
    punishments: weeks.filter((w) => w.debt).length,
  };

  return (
    <div>
      <Link href="/standings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} /> Standings
      </Link>
      <header className="mb-7">
        <p className="eyebrow">The record</p>
        <h1 className="font-big mt-2 text-[clamp(56px,20vw,80px)] leading-[0.82]">History</h1>
      </header>

      {weeks.length === 0 ? (
        <div className="rounded-2xl px-5 py-10 text-center shadow-[inset_0_0_0_1px_var(--color-line)]">
          <HistoryIcon size={28} className="mx-auto text-faint" />
          <p className="font-display mt-4 text-xl font-extrabold">No history yet.</p>
          <p className="mt-1 text-sm text-muted">Week one is being written right now. Make it count.</p>
        </div>
      ) : (
        <>
          <dl className="mb-9 grid grid-cols-3 border-y border-line py-4">
            <Stat label="Weeks played" value={totals.weeks} />
            <Stat label="Clean weeks" value={totals.clean} tone={totals.clean ? "volt" : undefined} />
            <Stat label="Punishments" value={totals.punishments} tone={totals.punishments ? "problem" : undefined} />
          </dl>

          <ol className="space-y-9">
            {weeks.map((w, i) => {
              const reached = season.reachedAt[w.weekStart] ?? {};
              const winner = season.byWeek[w.weekStart];
              // Finishing order: who hit their goal (earliest first), then who missed, then who was paused.
              const rows = [...w.rows].sort((a, b) => {
                const ra = reached[a.player.id];
                const rb = reached[b.player.id];
                if (ra && rb) return Date.parse(ra) - Date.parse(rb);
                if (ra || rb) return ra ? -1 : 1;
                return Number(a.exempt) - Number(b.exempt) || Number(b.completed) - Number(a.completed) || b.count - a.count;
              });
              return (
                <motion.li
                  key={w.weekStart}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.04 }}
                >
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="eyebrow">{weekRangeLabel(w.weekStart)}</p>
                      <h2 className="font-display mt-1 truncate text-[19px] font-extrabold">Week of {longDate(w.weekStart)}</h2>
                    </div>
                    <button
                      onClick={() => setReplay(w)}
                      className="pressable flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[12px] font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)] hover:text-ink"
                    >
                      <span aria-hidden className="h-0 w-0 border-y-[4.5px] border-l-[7px] border-y-transparent border-l-current" />
                      Replay
                    </button>
                  </div>

                  <ul className="mt-3 border-t border-line">
                    {rows.map((r, place) => {
                      const at = reached[r.player.id];
                      const isWinner = winner === r.player.id;
                      return (
                        <li key={r.player.id} className="flex items-center gap-3 border-b border-line py-2.5 text-sm">
                          <span className={`font-big w-7 shrink-0 text-[22px] leading-none ${isWinner ? "text-volt" : "text-faint"}`}>
                            {r.exempt && !r.completed ? "–" : r.completed ? String(place + 1).padStart(2, "0") : "DNF"}
                          </span>
                          <Avatar player={r.player} size={24} />
                          <span className={`min-w-0 flex-1 truncate font-semibold ${r.exempt ? "text-muted" : r.completed ? "" : "text-problem"}`}>
                            {r.player.name}
                            {isWinner && <span className="ml-2 font-mono text-[9.5px] font-medium tracking-[0.06em] text-volt uppercase">First in</span>}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] text-muted tabular">
                            {r.exempt && !r.completed
                              ? "PAUSED"
                              : at
                                ? `${DAY_SHORT[dayIndex(localDate(at, tz))]} ${formatTime(at, tz)}`
                                : `${r.count}/${r.requirement}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-3 text-sm">
                    {!w.debt ? (
                      <p className="font-mono text-[11px] tracking-[0.06em] text-volt uppercase">Everyone made it · no punishment</p>
                    ) : (
                      <Link href="/punishments" className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="text-muted">Punishment: </span>“{w.punishment}”
                          <span className="mt-0.5 block text-xs text-muted">
                            Courtesy of <b className="text-problem">{joinNames(w.culprits.map((l) => l.player.name))}</b>
                          </span>
                        </span>
                        {w.debt.status === "done" ? (
                          <span className="shrink-0 font-mono text-[10px] tracking-[0.06em] text-volt uppercase">Done ✓</span>
                        ) : (
                          <span className="shrink-0 rounded-[4px] bg-problem px-1.5 py-[2px] font-mono text-[10px] tracking-[0.06em] text-white uppercase">Owed</span>
                        )}
                      </Link>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </>
      )}

      <WeekReveal week={replay} open={!!replay} onClose={() => setReplay(null)} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "volt" | "problem" }) {
  return (
    <div className="text-center">
      <dd className="font-big text-[36px] leading-[0.9]" style={tone ? { color: `var(--color-${tone})` } : undefined}>
        {value}
      </dd>
      <dt className="eyebrow mt-1">{label}</dt>
    </div>
  );
}
