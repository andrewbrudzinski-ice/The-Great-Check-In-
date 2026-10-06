"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { WeekSummary } from "@/lib/game";
import { line } from "@/lib/trash";
import { weekRangeLabel } from "@/lib/week";
import { Avatar } from "./Avatar";
import { Confetti } from "./Confetti";

/**
 * The end-of-week drama. Steps: WEEK OVER → drumroll → loser(s) → punishment.
 * Tap anywhere to skip ahead.
 */
export function WeekReveal({
  week,
  open,
  onClose,
  streaks,
}: {
  week: WeekSummary | null;
  open: boolean;
  onClose: () => void;
  streaks?: Record<string, number>;
}) {
  const [step, setStep] = useState(0);
  const total = 4;

  useEffect(() => {
    if (!open) {
      setStep(0);
      return;
    }
    const timings = [1400, 1700, 2200];
    if (step >= timings.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), timings[step]);
    return () => clearTimeout(t);
  }, [open, step]);

  if (!week) return null;
  const losers = week.losers;
  const noLosers = losers.length === 0;
  const survivors = week.rows.filter((r) => r.completed);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] overflow-hidden bg-[#050506]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => (step < total - 1 ? setStep(total - 1) : undefined)}
          role="dialog"
          aria-modal="true"
          aria-label="Week results"
        >
          {/* spotlight */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: noLosers
                ? "radial-gradient(60% 45% at 50% 40%, rgba(200,255,61,0.16), transparent 70%)"
                : "radial-gradient(60% 45% at 50% 40%, rgba(251,65,102,0.18), transparent 70%)",
            }}
          />
          <div className="relative mx-auto flex h-full max-w-md flex-col items-center justify-center px-6 text-center">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="over" initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, y: -30 }} transition={{ type: "spring", stiffness: 200, damping: 18 }}>
                  <p className="eyebrow">{weekRangeLabel(week.weekStart)}</p>
                  <h2 className="font-display mt-3 text-7xl leading-[0.85] font-black">
                    WEEK
                    <br />
                    OVER
                  </h2>
                </motion.div>
              )}
              {step === 1 && (
                <motion.div key="drum" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="font-display text-2xl font-bold text-ink-2">
                    {noLosers ? "Let's see who failed…" : losers.length > 1 ? "And the losers are…" : "And the loser is…"}
                  </p>
                  <div className="mt-6 flex justify-center gap-2">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-2.5 w-2.5 rounded-full bg-ink"
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
              {step >= 2 && (
                <motion.div key="reveal" className="flex w-full flex-col items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {noLosers ? (
                    <>
                      <div className="relative">
                        <Confetti count={50} spread={320} />
                        <p className="eyebrow text-volt">Nobody</p>
                      </div>
                      <h2 className="font-display mt-2 text-6xl leading-[0.9] font-black">
                        EVERYONE
                        <br />
                        SURVIVED.
                      </h2>
                      <div className="mt-8 flex justify-center gap-3">
                        {survivors.map((r) => (
                          <div key={r.player.id} className="flex flex-col items-center gap-1.5">
                            <Avatar player={r.player} size={56} ring />
                            <span className="tabular text-xs text-ink-2">
                              {r.count}/{r.requirement}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="eyebrow text-problem">{losers.length > 1 ? "The losers" : "The loser"}</p>
                      <div className="mt-5 flex flex-wrap justify-center gap-6">
                        {losers.map((l, i) => (
                          <motion.div
                            key={l.player.id}
                            className="flex flex-col items-center"
                            initial={{ scale: 3, opacity: 0, rotate: -8 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 260, damping: 14, delay: i * 0.25 }}
                          >
                            <motion.div animate={{ x: [0, -6, 6, -4, 4, 0] }} transition={{ delay: 0.55 + i * 0.25, duration: 0.45 }}>
                              <Avatar player={l.player} size={losers.length > 1 ? 72 : 104} />
                            </motion.div>
                            <h2 className={`font-display mt-4 font-black ${losers.length > 1 ? "text-4xl" : "text-6xl"}`}>{l.player.name}</h2>
                            <p className="font-display tabular mt-1 text-lg font-bold text-problem">
                              {l.count} / {l.requirement} CHECK-INS
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    </>
                  )}

                  {step >= 3 && (
                    <motion.div className="mt-10 w-full" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 22 }}>
                      {!noLosers && (
                        <div className="rounded-3xl border border-problem/30 bg-problem/[0.07] px-5 py-5">
                          <p className="eyebrow text-problem/80">Your punishment</p>
                          <p className="font-display mt-2 text-2xl leading-tight font-extrabold">“{week.punishment}”</p>
                        </div>
                      )}
                      <p className="mt-5 text-sm text-muted">
                        {noLosers ? line("everyoneSafe", week.weekStart) : line("fail", week.weekStart)}
                      </p>
                      {streaks && survivors.length > 0 && (
                        <p className="mt-2 text-xs text-ink-2">
                          {survivors
                            .filter((s) => (streaks[s.player.id] ?? 0) > 1)
                            .map((s) => `${s.player.name} 🔥${streaks[s.player.id]}`)
                            .join("  ·  ")}
                        </p>
                      )}
                      <button
                        onClick={onClose}
                        className={`mt-8 w-full rounded-2xl py-4 font-display text-lg font-black tracking-wide ${noLosers ? "bg-volt text-volt-ink" : "bg-ink text-bg"}`}
                      >
                        {noLosers ? "Run it back" : "Accept fate"}
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={onClose} className="absolute top-[calc(var(--safe-top)+14px)] right-4 text-xs font-semibold text-muted">
            Skip
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
