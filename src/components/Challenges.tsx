"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { computeChallenges, quickAmounts, type ChallengeState, type PlayerChallenge } from "@/lib/challenges";
import { useGame } from "@/lib/store";
import { Avatar } from "./Avatar";
import { Confetti } from "./Confetti";
import { CheckIcon, ChevronRight, FlameIcon } from "./Icons";

export function useChallengeStates(): ChallengeState[] {
  const { data, game } = useGame();
  return useMemo(
    () => computeChallenges(data.challenges, data.challengeLogs, data.players, game.today, data.settings.timezone),
    [data.challenges, data.challengeLogs, data.players, game.today, data.settings.timezone],
  );
}

export const fmt = (n: number) => n.toLocaleString("en-US");

/** Progress bar for a challenge: lime while working, green once done. */
export function ChallengeBar({ value, target, height = 8 }: { value: number; target: number; height?: number }) {
  const pct = Math.min(1, target ? value / target : 0);
  const done = value >= target;
  return (
    <div className="relative w-full overflow-hidden rounded-full bg-surface-3" style={{ height }}>
      <motion.span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: done ? "var(--color-safe)" : "var(--color-volt)" }}
        initial={false}
        animate={{ width: `${pct * 100}%` }}
        transition={{ type: "spring", stiffness: 160, damping: 24 }}
      />
    </div>
  );
}

/** Quick-add buttons + a custom amount for logging a set. */
export function LogButtons({ state, compact = false }: { state: ChallengeState; compact?: boolean }) {
  const { logChallenge, me } = useGame();
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  const mine = state.players.find((p) => p.player.id === me?.id);

  async function add(amount: number) {
    if (!amount || amount < 1 || busy) return;
    setBusy(true);
    setError(null);
    const wasDone = mine?.done ?? false;
    try {
      await logChallenge(state.challenge.id, Math.round(amount));
      navigator.vibrate?.(10);
      if (!wasDone && mine && mine.today + amount >= mine.target) {
        setCelebrate((n) => n + 1);
        navigator.vibrate?.([20, 40, 60]);
      }
      setCustom("");
      setShowCustom(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't log that.");
    } finally {
      setBusy(false);
    }
  }

  const btn = `rounded-xl font-display font-black tabular transition-transform active:scale-95 disabled:opacity-50 ${
    compact ? "py-2.5 text-sm" : "py-3 text-base"
  }`;

  return (
    <div className="relative">
      {celebrate > 0 && <Confetti key={celebrate} count={32} spread={200} />}
      <div className="grid grid-cols-4 gap-2">
        {quickAmounts(state.challenge.dailyTarget).map((n) => (
          <button key={n} onClick={() => add(n)} disabled={busy} className={`${btn} bg-volt text-volt-ink`}>
            +{fmt(n)}
          </button>
        ))}
        <button onClick={() => setShowCustom((v) => !v)} disabled={busy} className={`${btn} bg-surface-3 text-ink`} aria-expanded={showCustom}>
          {showCustom ? "×" : "+ #"}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {showCustom && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              add(Number(custom));
            }}
          >
            <div className="flex gap-2 pt-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                autoFocus
                placeholder={`How many ${state.challenge.unit}?`}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink outline-none focus:border-volt/60"
              />
              <button disabled={busy || !Number(custom)} className="rounded-xl bg-volt px-5 font-display font-black text-volt-ink disabled:opacity-50">
                Add
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      {error && <p className="mt-2 text-sm text-problem">{error}</p>}
    </div>
  );
}

function OtherRow({ p, unit }: { p: PlayerChallenge; unit: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <Avatar player={p.player} size={24} />
      <span className="w-16 truncate text-xs font-semibold">{p.player.name}</span>
      <div className="flex-1">
        <ChallengeBar value={p.today} target={p.target} height={5} />
      </div>
      <span className="tabular w-[72px] text-right text-xs text-muted" aria-label={`${p.today} of ${p.target} ${unit}`}>
        {p.done ? (
          <span className="inline-flex items-center gap-0.5 font-semibold text-safe">
            <CheckIcon size={12} strokeWidth={3} /> {fmt(p.today)}
          </span>
        ) : (
          `${fmt(p.today)}/${fmt(p.target)}`
        )}
      </span>
      <span className={`inline-flex w-7 items-center justify-end gap-0.5 text-[11px] font-bold tabular ${p.streak ? "text-orange-300" : "text-transparent"}`}>
        <FlameIcon size={11} strokeWidth={2.4} />
        {p.streak}
      </span>
    </li>
  );
}

/** Home-screen card: your progress + quick log, and how everyone else is doing. */
export function ChallengeCard({ state }: { state: ChallengeState }) {
  const { me } = useGame();
  const c = state.challenge;
  const mine = state.players.find((p) => p.player.id === me?.id);
  const others = state.players.filter((p) => p.player.id !== me?.id);

  return (
    <div className={`rounded-3xl border p-4 ${mine?.done ? "border-safe/25 bg-safe/[0.04]" : "border-line bg-surface/60"}`}>
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          {c.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[17px] leading-tight font-extrabold">{c.name}</p>
          <p className="text-xs text-muted">
            {fmt(c.dailyTarget)} {c.unit} a day
            {state.everyoneDone ? " · everyone's done 🎉" : ` · ${state.doneCount}/${state.players.length} done`}
          </p>
        </div>
        <Link href="/challenges" className="flex items-center text-xs font-semibold text-muted hover:text-ink">
          Details <ChevronRight size={14} />
        </Link>
      </div>

      {mine && (
        <div className="mt-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-display tabular text-3xl leading-none font-black">
              {fmt(mine.today)}
              <span className="text-base text-muted">/{fmt(mine.target)}</span>
            </span>
            <span className="text-xs">
              {mine.done ? (
                <span className="font-display font-black tracking-wider text-safe">DONE ✓</span>
              ) : (
                <span className="text-muted">
                  {fmt(mine.remaining)} {c.unit} to go
                </span>
              )}
              {mine.streak > 0 && (
                <span className="ml-2 inline-flex items-center gap-0.5 font-bold text-orange-300">
                  <FlameIcon size={12} strokeWidth={2.4} />
                  {mine.streak}
                </span>
              )}
            </span>
          </div>
          <ChallengeBar value={mine.today} target={mine.target} />
          <div className="mt-3">
            <LogButtons state={state} compact />
          </div>
        </div>
      )}

      {others.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-line pt-3">
          {others.map((p) => (
            <OtherRow key={p.player.id} p={p} unit={c.unit} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** All active challenges for Home, plus a nudge to add one if there are none. */
export function ChallengesHome() {
  const states = useChallengeStates();
  if (states.length === 0) {
    return (
      <Link href="/challenges" className="flex items-center justify-between rounded-2xl border border-dashed border-line-strong px-4 py-3.5 text-sm text-muted hover:text-ink">
        <span>💪 Add a daily challenge (like 100 pushups)</span>
        <ChevronRight size={16} />
      </Link>
    );
  }
  return (
    <div className="space-y-3">
      {states.map((s) => (
        <ChallengeCard key={s.challenge.id} state={s} />
      ))}
    </div>
  );
}
