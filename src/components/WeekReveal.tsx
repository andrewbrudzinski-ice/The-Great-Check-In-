"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { WeekSummary } from "@/lib/game";
import { firstToGoal } from "@/lib/season";
import { useApp } from "@/lib/store";
import { joinNames, line } from "@/lib/trash";
import { DAY_SHORT, dayIndex, formatTime, localDate, weekRangeLabel } from "@/lib/week";
import { Avatar } from "./Avatar";
import { Confetti } from "./Confetti";
import { FlameIcon } from "./Icons";

/**
 * The end-of-week drama, told as race results.
 * Steps: WEEK OVER → drumroll → the results board, one finisher at a time
 * (place, when they hit their goal, DNF for misses) → the punishment.
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
  const { data } = useApp();
  const tz = data?.settings.timezone ?? "UTC";
  const [step, setStep] = useState(0);
  const total = 4;

  useEffect(() => {
    if (!open) {
      setStep(0);
      return;
    }
    const timings = [1400, 1500, 2600];
    if (step >= timings.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), timings[step]);
    return () => clearTimeout(t);
  }, [open, step]);

  const reached = useMemo(() => (week && data ? (firstToGoal([week], data.checkIns, tz).reachedAt[week.weekStart] ?? {}) : {}), [week, data, tz]);

  if (!week) return null;
  const losers = week.culprits;
  const noLosers = losers.length === 0;
  const survivors = week.rows.filter((r) => r.completed);
  // Finishing order: who hit their goal (earliest first), then misses, then paused.
  const rows = [...week.rows].sort((a, b) => {
    const ra = reached[a.player.id];
    const rb = reached[b.player.id];
    if (ra && rb) return Date.parse(ra) - Date.parse(rb);
    if (ra || rb) return ra ? -1 : 1;
    return Number(a.exempt) - Number(b.exempt) || Number(b.completed) - Number(a.completed) || b.count - a.count;
  });
  const winner = rows.find((r) => reached[r.player.id]);
  const onStreak = survivors.filter((s) => (streaks?.[s.player.id] ?? 0) > 1);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] overflow-y-auto bg-[#050506]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => (step < total - 1 ? setStep(total - 1) : undefined)}
          role="dialog"
          aria-modal="true"
          aria-label="Week results"
        >
          <div aria-hidden className="grid-texture pointer-events-none absolute inset-x-0 top-0 h-[60%]" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: noLosers
                ? "radial-gradient(60% 40% at 50% 30%, rgb(200 255 61 / 0.14), transparent 70%)"
                : "radial-gradient(60% 40% at 50% 30%, rgb(255 77 106 / 0.12), transparent 70%)",
            }}
          />
          <div className="relative mx-auto flex min-h-full max-w-md flex-col justify-center px-6 pt-[calc(var(--safe-top)+56px)] pb-[calc(var(--safe-bottom)+28px)]">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="over"
                  className="text-center"
                  initial={{ scale: 1.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0, y: -24, transition: { duration: 0.22 } }}
                  transition={{ type: "spring", stiffness: 200, damping: 18 }}
                >
                  <p className="eyebrow">{weekRangeLabel(week.weekStart)}</p>
                  <h2 className="font-big mt-3 text-[clamp(88px,32vw,132px)] leading-[0.8] uppercase">
                    Week
                    <br />
                    over
                  </h2>
                </motion.div>
              )}
              {step === 1 && (
                <motion.div key="drum" className="text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }}>
                  <p className="eyebrow">{weekRangeLabel(week.weekStart)}</p>
                  <p className="font-big mt-3 text-[44px] leading-[0.9] uppercase">The results are in</p>
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
                <motion.div key="results" className="w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="relative text-center">
                    {noLosers && <Confetti count={44} spread={300} />}
                    <p className={`eyebrow ${noLosers ? "!text-volt" : "!text-problem"}`}>{weekRangeLabel(week.weekStart)} · results</p>
                    <h2 className="font-big mt-2 text-[clamp(52px,17vw,72px)] leading-[0.86] uppercase">
                      {noLosers ? "Everyone survived." : losers.length > 1 ? "Group's on the hook." : `${losers[0].player.name} sank it.`}
                    </h2>
                  </div>

                  <ol className="mt-7 border-t border-line">
                    {rows.map((r, i) => {
                      const at = reached[r.player.id];
                      const dnf = !r.completed && !r.exempt;
                      const isWinner = winner?.player.id === r.player.id;
                      return (
                        <motion.li
                          key={r.player.id}
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.22, type: "spring", stiffness: 260, damping: 26 }}
                          className={`flex items-center gap-3 border-b border-line py-3 ${dnf ? "risk-hatch -mx-2 px-2" : ""}`}
                        >
                          <span className={`font-big w-10 shrink-0 text-[28px] leading-none ${isWinner ? "text-volt" : dnf ? "text-problem" : "text-faint"}`}>
                            {r.exempt && !r.completed ? "–" : dnf ? "DNF" : String(i + 1).padStart(2, "0")}
                          </span>
                          <Avatar player={r.player} size={36} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-display text-[17px] font-extrabold">{r.player.name}</span>
                            {isWinner && <span className="font-mono text-[9.5px] tracking-[0.06em] text-volt uppercase">First in</span>}
                          </span>
                          <span className={`shrink-0 text-right font-mono text-[11px] tabular ${dnf ? "text-problem" : "text-muted"}`}>
                            {r.exempt && !r.completed
                              ? "PAUSED"
                              : at
                                ? `${DAY_SHORT[dayIndex(localDate(at, tz))]} ${formatTime(at, tz)}`
                                : `${r.count}/${r.requirement}`}
                          </span>
                        </motion.li>
                      );
                    })}
                  </ol>

                  {step >= 3 && (
                    <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 22 }}>
                      {!noLosers && (
                        <div className="relative mt-7 rounded-[22px] bg-surface shadow-[inset_0_0_0_1px_rgb(255_77_106/0.28)]">
                          <div className="px-5 pt-5 pb-4">
                            <p className="eyebrow !text-problem">Everyone&apos;s punishment</p>
                            <p className="font-big mt-2 text-[30px] leading-[0.98]">“{week.punishment}”</p>
                          </div>
                          <div aria-hidden className="mx-3.5 h-px bg-[linear-gradient(90deg,rgb(255_255_255/0.2)_50%,transparent_50%)] bg-[length:8px_1px]" />
                          <p className="px-5 py-3.5 text-[12.5px] text-ink-2">
                            Courtesy of <b className="text-problem">{joinNames(losers.map((l) => l.player.name))}</b>.
                          </p>
                        </div>
                      )}
                      <p className="mt-5 text-center text-sm text-muted">{noLosers ? line("everyoneSafe", week.weekStart) : line("fail", week.weekStart)}</p>
                      {onStreak.length > 0 && (
                        <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-2">
                          {onStreak.map((s) => (
                            <span key={s.player.id} className="inline-flex items-center gap-1">
                              {s.player.name}
                              <FlameIcon size={12} strokeWidth={2.2} className="text-ember" />
                              <b className="font-semibold text-ember">{streaks?.[s.player.id]}</b>
                            </span>
                          ))}
                        </p>
                      )}
                      <button
                        onClick={onClose}
                        className={`pressable mt-7 h-14 w-full rounded-2xl font-display text-lg font-extrabold ${noLosers ? "bg-volt text-volt-ink" : "bg-ink text-bg"}`}
                      >
                        {noLosers ? "Run it back" : "Accept fate"}
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={onClose}
            className="fixed top-[calc(var(--safe-top)+10px)] right-3 z-10 rounded-full px-3 py-2 font-mono text-[11px] tracking-[0.06em] text-muted uppercase hover:text-ink"
          >
            Skip
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
