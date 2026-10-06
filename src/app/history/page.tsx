"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { WeekReveal } from "@/components/WeekReveal";
import { PageTitle } from "@/components/ui";
import type { WeekSummary } from "@/lib/game";
import { useGame } from "@/lib/store";
import { joinNames } from "@/lib/trash";
import { longDate, weekRangeLabel } from "@/lib/week";

export default function HistoryPage() {
  const { game } = useGame();
  const [replay, setReplay] = useState<WeekSummary | null>(null);
  const weeks = game.history;

  const totals = {
    weeks: weeks.length,
    clean: weeks.filter((w) => !w.debt).length,
    punishments: weeks.filter((w) => w.debt).length,
  };

  return (
    <div>
      <PageTitle eyebrow="The record" title="History" />

      {weeks.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-4xl">📜</p>
          <p className="font-display mt-4 text-xl font-extrabold">No history yet.</p>
          <p className="mt-1 text-sm text-muted">Week one is being written right now. Make it count.</p>
        </div>
      ) : (
        <>
          <dl className="mb-8 grid grid-cols-3 border-y border-line py-4 text-center">
            <Stat label="Weeks played" value={totals.weeks} />
            <Stat label="Clean weeks" value={totals.clean} />
            <Stat label="Punishments" value={totals.punishments} />
          </dl>

          <ol className="space-y-3">
            {weeks.map((w, i) => (
              <motion.li
                key={w.weekStart}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.04 }}
                className="rounded-3xl border border-line bg-surface/50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">{weekRangeLabel(w.weekStart)}</p>
                    <h2 className="font-display mt-1 text-lg font-extrabold">Week of {longDate(w.weekStart)}</h2>
                  </div>
                  <button
                    onClick={() => setReplay(w)}
                    className="shrink-0 rounded-full bg-surface-3 px-3 py-1.5 text-[11px] font-semibold text-ink-2 hover:text-ink"
                  >
                    ▶ Replay
                  </button>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {w.rows.map((r) => (
                    <li key={r.player.id} className="flex items-center gap-2.5 text-sm">
                      <Avatar player={r.player} size={24} />
                      <span className={`flex-1 ${r.completed ? "" : "text-problem"}`}>{r.player.name}</span>
                      <span className="tabular font-semibold">
                        {r.count}/{r.requirement}
                      </span>
                      <span className={`w-5 text-center ${r.completed ? "text-safe" : "text-problem"}`} aria-label={r.completed ? "completed" : "failed"}>
                        {r.completed ? "✓" : "✕"}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 border-t border-line pt-3 text-sm">
                  {!w.debt ? (
                    <p className="font-display font-extrabold text-safe">Everyone made it. No punishment. 🎉</p>
                  ) : (
                    <Link href="/punishments" className="block">
                      <p className="flex items-start justify-between gap-3">
                        <span>
                          <span className="text-muted">Group punishment: </span>“{w.punishment}”
                        </span>
                        {w.debt.status === "done" ? (
                          <span className="shrink-0 rounded-full bg-safe/15 px-2 py-0.5 font-display text-[10px] font-black tracking-[0.1em] text-safe">DONE ✓</span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-problem/15 px-2 py-0.5 font-display text-[10px] font-black tracking-[0.1em] text-problem">OWED</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Courtesy of <b className="text-problem">{joinNames(w.culprits.map((l) => l.player.name))}</b>
                      </p>
                    </Link>
                  )}
                </div>
              </motion.li>
            ))}
          </ol>
        </>
      )}

      <WeekReveal week={replay} open={!!replay} onClose={() => setReplay(null)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="font-display tabular text-3xl font-black">{value}</dd>
      <dt className="mt-0.5 text-[10px] font-semibold tracking-wider text-muted uppercase">{label}</dt>
    </div>
  );
}
