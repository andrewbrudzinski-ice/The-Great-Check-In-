"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Confetti } from "@/components/Confetti";
import { CheckIcon, ChevronLeft } from "@/components/Icons";
import { PageTitle, SectionTitle, Sheet } from "@/components/ui";
import type { WeekSummary } from "@/lib/game";
import { useGame } from "@/lib/store";
import { joinNames } from "@/lib/trash";
import { formatDateTime, longDate, weekRangeLabel } from "@/lib/week";

export default function PunishmentsPage() {
  const { data, game, me, setPunishmentDone } = useGame();
  const s = data.settings;
  const [confirm, setConfirm] = useState<WeekSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(0);

  const short = game.standings.filter((p) => !p.completed && !p.warmup && !p.paused);
  const clean = game.history.filter((w) => !w.debt).length;
  const playerName = (id: string | null) => data.players.find((p) => p.id === id)?.name ?? "someone";

  async function mark(w: WeekSummary, done: boolean) {
    setBusy(true);
    setError(null);
    try {
      await setPunishmentDone(w.weekStart, done);
      if (done) {
        setCelebrate((n) => n + 1);
        navigator.vibrate?.([20, 40, 60]);
      }
      setConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Link href="/standings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} /> Standings
      </Link>
      <PageTitle eyebrow="One misses, everyone pays" title="Punishments" />

      {/* Scoreboard */}
      <div className="relative">
        {celebrate > 0 && <Confetti key={celebrate} count={40} spread={240} />}
        {game.owed.length === 0 ? (
          <motion.div
            key="square"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-3xl bg-volt px-5 py-6 text-volt-ink"
          >
            <p className="font-big text-[48px] leading-[0.9] uppercase">All square.</p>
            <p className="mt-2 text-sm font-medium opacity-70">Nothing owed. Enjoy it while it lasts.</p>
          </motion.div>
        ) : (
          <div className="rounded-[22px] bg-surface px-5 py-5 shadow-[inset_0_0_0_1px_rgb(255_77_106/0.25)]">
            <p className="eyebrow !text-problem">Owed by the group</p>
            <p className="mt-1 flex items-baseline gap-2">
              <motion.span
                key={game.owed.length}
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-big text-[80px] leading-[0.85] text-problem"
              >
                {game.owed.length}
              </motion.span>
              <span className="font-display text-lg font-extrabold">punishment{game.owed.length === 1 ? "" : "s"}</span>
            </p>
            <p className="mt-2 text-sm text-ink-2">Settle up, then mark it done below.</p>
          </div>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-3 border-b border-line pb-5 text-center">
        <Stat label="Owed" value={game.owed.length} tone={game.owed.length ? "problem" : undefined} />
        <Stat label="Done" value={game.paid.length} tone={game.paid.length ? "safe" : undefined} />
        <Stat label="Clean weeks" value={clean} />
      </dl>

      {/* The deal */}
      <section className="mt-8">
        <SectionTitle right={me?.isOwner ? <Link href="/settings" className="text-[11px] font-semibold text-muted hover:text-ink">Edit</Link> : undefined}>
          The deal
        </SectionTitle>
        <p className="font-big text-[34px] leading-[0.98]">
          <span className="text-volt">“</span>
          {s.punishment}
          <span className="text-volt">”</span>
        </p>
        <p className="mt-2 text-sm text-muted">
          If anyone finishes a week under their check-in goal, the <b className="text-ink-2">whole group</b> does it together.
        </p>
        <p className="mt-3 text-sm">
          {short.length === 0 ? (
            <span className="text-safe">✓ This week is on track to be clean.</span>
          ) : (
            <>
              <span className="text-muted">If the week ended now, </span>
              <b className="text-problem">{joinNames(short.map((p) => p.player.name))}</b>
              <span className="text-muted"> would put everyone on the hook.</span>
            </>
          )}
        </p>
      </section>

      {/* Owed */}
      <section className="mt-10">
        <SectionTitle>Owed</SectionTitle>
        {game.owed.length === 0 ? (
          <p className="py-2 text-sm text-muted">Nothing owed. Suspicious, but we&apos;ll allow it.</p>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {game.owed.map((w) => {
                const ageDays = Math.floor((Date.now() - new Date(w.weekEnd + "T23:59:59Z").getTime()) / 86400000);
                return (
                  <motion.li
                    key={w.weekStart}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 60, transition: { duration: 0.25 } }}
                    className="relative rounded-[22px] bg-surface p-4 shadow-[inset_0_0_0_1px_rgb(255_77_106/0.22)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="eyebrow">{weekRangeLabel(w.weekStart)}</p>
                        <p className="font-display mt-1 text-lg font-extrabold">Week of {longDate(w.weekStart)}</p>
                      </div>
                      <span className="shrink-0 rounded-[4px] bg-problem px-1.5 py-[3px] font-mono text-[10px] font-medium tracking-[0.06em] text-white">
                        {ageDays <= 0 ? "DUE NOW" : `OWED ${ageDays}D`}
                      </span>
                    </div>
                    <p className="font-big mt-3 text-[28px] leading-[0.98]">“{w.punishment}”</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="flex -space-x-2">
                        {w.culprits.map((c) => (
                          <Avatar key={c.player.id} player={c.player} size={26} />
                        ))}
                      </span>
                      <p className="text-xs text-muted">
                        Courtesy of{" "}
                        {w.culprits.map((c, i) => (
                          <span key={c.player.id}>
                            {i > 0 && (i === w.culprits.length - 1 ? " & " : ", ")}
                            <b className="text-ink-2">{c.player.name}</b> ({c.count}/{c.requirement})
                          </span>
                        ))}
                      </p>
                    </div>
                    <div aria-hidden className="-mx-1 mt-4 h-px bg-[linear-gradient(90deg,rgb(255_255_255/0.2)_50%,transparent_50%)] bg-[length:8px_1px]" />
                    <button
                      onClick={() => setConfirm(w)}
                      className="pressable mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[15px] font-semibold text-bg"
                    >
                      <CheckIcon size={18} strokeWidth={2.6} /> We did it
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {/* Done */}
      <section className="mt-10">
        <SectionTitle>Done</SectionTitle>
        {game.paid.length === 0 ? (
          <p className="py-2 text-sm text-muted">No punishments served yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {game.paid.map((w) => (
              <motion.li key={w.weekStart} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-safe/15 text-safe">
                  <CheckIcon size={14} strokeWidth={2.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{weekRangeLabel(w.weekStart)}</span>
                    <span className="text-muted"> · “{w.punishment}”</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Thanks to {joinNames(w.culprits.map((c) => c.player.name))}
                    {w.debt?.completedAt && (
                      <>
                        {" "}· done {formatDateTime(w.debt.completedAt, s.timezone)} · marked by {playerName(w.debt.completedBy)}
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => mark(w, false)}
                  disabled={busy}
                  className="shrink-0 text-[11px] font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  Undo
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 text-center text-[11px] text-muted">No payments are processed. Honor system. Shame is enforced.</p>

      <Sheet open={!!confirm} onClose={() => setConfirm(null)}>
        {confirm && (
          <div className="pt-1 pb-2 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-volt text-volt-ink">
              <CheckIcon size={30} strokeWidth={2.8} />
            </span>
            <h3 className="font-big mt-5 text-[40px] leading-[0.9] uppercase">Punishment served?</h3>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-2">
              “{confirm.punishment}” for the week of {longDate(confirm.weekStart)}. Everyone will see you marked it done.
            </p>
            {error && <p className="mt-3 text-sm text-problem">{error}</p>}
            <button
              onClick={() => mark(confirm, true)}
              disabled={busy}
              className="pressable mt-6 h-14 w-full rounded-2xl bg-volt font-display text-lg font-extrabold text-volt-ink disabled:opacity-60"
            >
              {busy ? "Saving…" : "Yes, it's done"}
            </button>
            <button onClick={() => setConfirm(null)} className="mt-2 w-full py-2 text-sm text-muted hover:text-ink">
              Not yet
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "safe" | "problem" }) {
  return (
    <div>
      <dd className="font-big text-[34px] leading-none" style={tone ? { color: `var(--color-${tone})` } : undefined}>
        {value}
      </dd>
      <dt className="eyebrow mt-1">{label}</dt>
    </div>
  );
}
