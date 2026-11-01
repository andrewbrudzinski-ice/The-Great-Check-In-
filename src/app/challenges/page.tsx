"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ChallengeBar, fmt, LogButtons, useChallengeStates } from "@/components/Challenges";
import { ChevronLeft, FlameIcon } from "@/components/Icons";
import { PageTitle, SectionTitle, Sheet } from "@/components/ui";
import type { ChallengeDay, ChallengeState } from "@/lib/challenges";
import { useGame } from "@/lib/store";
import type { Challenge } from "@/lib/types";
import { DAY_SHORT, dayIndex, formatTime } from "@/lib/week";

const EMOJIS = ["💪", "🏋️", "🧱", "🏃", "🚴", "🧘", "🦵", "🔥", "💧", "🥗", "😴", "📚", "🚶", "🤸", "🥊", "⏱️"];
const UNITS = ["reps", "min", "km", "miles", "steps", "glasses", "pages"];

export default function ChallengesPage() {
  const states = useChallengeStates();
  const [editing, setEditing] = useState<Challenge | "new" | null>(null);

  return (
    <div>
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} /> Home
      </Link>
      <PageTitle
        eyebrow="Every day, on top of the gym"
        title="Challenges"
        right={
          <button onClick={() => setEditing("new")} className="rounded-full bg-volt px-4 py-2 font-display text-sm font-black text-volt-ink">
            + New
          </button>
        }
      />

      {states.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-4xl">💪</p>
          <p className="font-display mt-4 text-xl font-extrabold">No daily challenges yet.</p>
          <p className="mt-1 text-sm text-muted">Pushups, planks, steps, water… anything with a daily number.</p>
          <button onClick={() => setEditing("new")} className="mt-6 rounded-full bg-volt px-6 py-3 font-display font-black text-volt-ink">
            Add one
          </button>
        </div>
      )}

      <div className="space-y-12">
        {states.map((s) => (
          <ChallengeSection key={s.challenge.id} state={s} onEdit={() => setEditing(s.challenge)} />
        ))}
      </div>

      <p className="mt-12 text-center text-[11px] text-muted">Honor system. Anyone can add, change or retire a challenge.</p>

      <Sheet open={editing !== null} onClose={() => setEditing(null)}>
        {editing !== null && <ChallengeForm challenge={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

function ChallengeSection({ state, onEdit }: { state: ChallengeState; onEdit: () => void }) {
  const { me, data, deleteChallengeLog } = useGame();
  const c = state.challenge;
  const mine = state.players.find((p) => p.player.id === me?.id);
  const days = state.players[0]?.last7.map((d) => d.day) ?? [];
  const [error, setError] = useState<string | null>(null);

  return (
    <section>
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none" aria-hidden>
          {c.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight font-black">{c.name}</h2>
          <p className="text-sm text-muted">
            {fmt(c.dailyTarget)} {c.unit} every day
          </p>
        </div>
        <button onClick={onEdit} className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-2 hover:text-ink">
          Edit
        </button>
      </div>

      {mine && (
        <div className="mt-5 rounded-3xl border border-line bg-surface/60 p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="eyebrow">You today</span>
            <span className="font-display tabular text-2xl font-black">
              {fmt(mine.today)}
              <span className="text-sm text-muted">/{fmt(mine.target)}</span>
            </span>
          </div>
          <ChallengeBar value={mine.today} target={mine.target} />
          <div className="mt-3">
            <LogButtons state={state} />
          </div>
          {mine.logsToday.length > 0 && (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {mine.logsToday.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <b className="tabular">+{fmt(l.amount)}</b> <span className="text-muted">{c.unit}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular text-xs text-muted">{formatTime(l.loggedAt, data.settings.timezone)}</span>
                    <button
                      onClick={async () => {
                        setError(null);
                        try {
                          await deleteChallengeLog(l.id);
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Couldn't undo.");
                        }
                      }}
                      className="text-xs font-semibold text-muted hover:text-problem"
                    >
                      Undo
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="mt-2 text-sm text-problem">{error}</p>}
        </div>
      )}

      <div className="mt-6">
        <SectionTitle>Last 7 days</SectionTitle>
        <div className="grid gap-y-2.5" style={{ gridTemplateColumns: "minmax(0,1fr) repeat(7, 28px) 36px" }}>
          <span />
          {days.map((d) => (
            <span key={d} className={`text-center text-[10px] font-bold uppercase ${d === days[6] ? "text-volt" : "text-muted"}`}>
              {DAY_SHORT[dayIndex(d)].slice(0, 2)}
            </span>
          ))}
          <span className="text-right text-[10px] font-bold text-muted uppercase">
            <FlameIcon size={11} className="inline" />
          </span>
          {state.players.map((p) => (
            <Row key={p.player.id} name={p.player.name} avatar={<Avatar player={p.player} size={22} />} last7={p.last7} streak={p.streak} unit={c.unit} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Row({ name, avatar, last7, streak, unit }: { name: string; avatar: React.ReactNode; last7: ChallengeDay[]; streak: number; unit: string }) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {avatar}
        <span className="truncate text-sm font-semibold">{name}</span>
      </span>
      {last7.map((d) => (
        <DayCell key={d.day} d={d} unit={unit} />
      ))}
      <span className={`self-center text-right text-sm font-black tabular ${streak ? "text-orange-300" : "text-muted"}`}>{streak}</span>
    </>
  );
}

/** Filled green = target hit; a ring filled part-way = partial; dim dot = nothing. */
function DayCell({ d, unit }: { d: ChallengeDay; unit: string }) {
  const pct = Math.min(1, d.target ? d.total / d.target : 0);
  const label = `${DAY_SHORT[dayIndex(d.day)]}: ${fmt(d.total)} of ${fmt(d.target)} ${unit}`;
  return (
    <span className="grid place-items-center" title={label} aria-label={label} role="img">
      {d.done ? (
        <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="grid h-6 w-6 place-items-center rounded-full bg-safe text-[11px] font-black text-bg">
          ✓
        </motion.span>
      ) : d.total > 0 ? (
        <span
          className="h-6 w-6 rounded-full"
          style={{ background: `conic-gradient(var(--color-volt) ${pct * 360}deg, var(--color-surface-3) 0deg)` }}
        >
          <span className="m-[4px] block h-4 w-4 rounded-full bg-bg" />
        </span>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-surface-3" />
      )}
    </span>
  );
}

const field =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-ink outline-none placeholder:text-muted/60 focus:border-volt/60";

function ChallengeForm({ challenge, onDone }: { challenge: Challenge | null; onDone: () => void }) {
  const { saveChallenge, archiveChallenge } = useGame();
  const [name, setName] = useState(challenge?.name ?? "");
  const [emoji, setEmoji] = useState(challenge?.emoji ?? "💪");
  const [target, setTarget] = useState(String(challenge?.dailyTarget ?? 100));
  const [unit, setUnit] = useState(challenge?.unit ?? "reps");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targetN = Math.round(Number(target));
  const ok = name.trim().length > 0 && targetN >= 1 && targetN <= 100000 && unit.trim().length > 0;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-1">
      <h3 className="font-display text-2xl font-black">{challenge ? "Edit challenge" : "New daily challenge"}</h3>
      <div className="mt-4 space-y-4">
        <input className={field} placeholder="Name, e.g. Pushups" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-2">Icon</p>
          <div className="grid grid-cols-8 gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                aria-label={`Icon ${e}`}
                aria-pressed={emoji === e}
                className={`grid aspect-square place-items-center rounded-xl text-xl ${emoji === e ? "bg-surface-3 ring-1 ring-volt" : "bg-surface-2"}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[1fr_1.2fr] gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-2">Daily target</span>
            <input className={`${field} tabular`} type="number" inputMode="numeric" min={1} value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-2">Unit</span>
            <input className={field} value={unit} maxLength={20} onChange={(e) => setUnit(e.target.value)} list="challenge-units" />
            <datalist id="challenge-units">
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </label>
        </div>
        <p className="text-xs text-muted">
          {emoji} {name || "Challenge"}: {targetN > 0 ? fmt(targetN) : "?"} {unit || "reps"} a day.
          {challenge && " Changing the target applies from today; past days keep their old target."}
        </p>
        {error && <p className="text-sm text-problem">{error}</p>}
        <button
          onClick={() => run(() => saveChallenge({ id: challenge?.id, name, emoji, dailyTarget: targetN, unit }))}
          disabled={busy || !ok}
          className="w-full rounded-2xl bg-volt py-3.5 font-display text-lg font-black text-volt-ink disabled:bg-surface-3 disabled:text-muted"
        >
          {busy ? "Saving…" : challenge ? "Save changes" : "Add challenge"}
        </button>
        {challenge && (
          <button
            onClick={() => confirm(`Retire ${challenge.name}? Its history is kept.`) && run(() => archiveChallenge(challenge.id))}
            disabled={busy}
            className="w-full py-2 text-sm font-semibold text-muted hover:text-problem"
          >
            Retire this challenge
          </button>
        )}
      </div>
    </div>
  );
}
