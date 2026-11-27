"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ChallengeBar, fmt, LogButtons, useChallengeStates } from "@/components/Challenges";
import { ChevronLeft, FlameIcon } from "@/components/Icons";
import { PageTitle, SectionTitle, Sheet } from "@/components/ui";
import { pickFor, sortedChallenges, type ChallengeDay, type ChallengeState } from "@/lib/challenges";
import { useGame } from "@/lib/store";
import type { Challenge } from "@/lib/types";
import { DAY_SHORT, dayIndex, formatTime } from "@/lib/week";

const EMOJIS = ["💪", "🏋️", "🧱", "🏃", "🚴", "🧘", "🦵", "🔥", "💧", "🥗", "😴", "📚", "🚶", "🤸", "🥊", "⏱️"];
const UNITS = ["reps", "min", "km", "miles", "steps", "glasses", "pages"];

/** Suggestions. Nothing is added until someone taps Add (and the number can be edited after). */
const IDEAS = [
  { name: "Squats", emoji: "🦵", dailyTarget: 100, unit: "reps" },
  { name: "Lunges", emoji: "🦵", dailyTarget: 50, unit: "reps" },
  { name: "Plank", emoji: "🧱", dailyTarget: 3, unit: "min" },
  { name: "Jumping jacks", emoji: "🤸", dailyTarget: 100, unit: "reps" },
  { name: "Mountain climbers", emoji: "🏃", dailyTarget: 50, unit: "reps" },
  { name: "Wall sit", emoji: "🧱", dailyTarget: 3, unit: "min" },
  { name: "Dips", emoji: "💪", dailyTarget: 50, unit: "reps" },
  { name: "Pull-ups", emoji: "🏋️", dailyTarget: 25, unit: "reps" },
  { name: "Steps", emoji: "🚶", dailyTarget: 10000, unit: "steps" },
];

export default function ChallengesPage() {
  const { data } = useGame();
  const states = useChallengeStates();
  const rotation = data.settings.challengeRotation;
  const [editing, setEditing] = useState<Challenge | "new" | null>(null);

  return (
    <div>
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} /> Home
      </Link>
      <PageTitle
        eyebrow={rotation ? "A random one every day" : "Every day, on top of the gym"}
        title="Challenges"
        right={
          <button onClick={() => setEditing("new")} className="rounded-full bg-volt px-4 py-2 font-display text-sm font-black text-volt-ink">
            + New
          </button>
        }
      />

      {states.length === 0 && (
        <div className="py-12 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-volt shadow-[inset_0_0_0_1px_var(--color-line)]" aria-hidden>
            <FlameIcon size={26} />
          </span>
          <p className="font-display mt-4 text-xl font-extrabold">No daily challenges yet.</p>
          <p className="mt-1 text-sm text-muted">Pushups, planks, steps, water… anything with a daily number.</p>
          <button onClick={() => setEditing("new")} className="mt-6 rounded-full bg-volt px-6 py-3 font-display font-black text-volt-ink">
            Add one
          </button>
        </div>
      )}

      <div className="space-y-12">
        {states.map((s) => (
          <ChallengeSection key={s.challenge.id} state={s} rotation={rotation} onEdit={() => setEditing(s.challenge)} />
        ))}
        {rotation && states.length > 0 && <MixPanel onEdit={setEditing} />}
        <IdeasPanel />
        <ModeSwitch />
      </div>

      <p className="mt-12 text-center text-[11px] text-muted">Honor system. Anyone can add, change or retire a challenge.</p>

      <Sheet open={editing !== null} onClose={() => setEditing(null)}>
        {editing !== null && <ChallengeForm challenge={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

/** Everything that can come up, with when each was last picked. */
function MixPanel({ onEdit }: { onEdit: (c: Challenge) => void }) {
  const { data, game } = useGame();
  const mix = sortedChallenges(data.challenges);
  const lastPicked = (id: string) =>
    data.challengePicks
      .filter((p) => p.challengeId === id && p.day <= game.today)
      .map((p) => p.day)
      .sort()
      .pop();
  const ago = (day?: string) => {
    if (!day) return "not picked yet";
    if (day === game.today) return "today";
    const n = Math.round((Date.parse(game.today) - Date.parse(day)) / 86400000);
    return n === 1 ? "last: yesterday" : n < 7 ? `last: ${DAY_SHORT[dayIndex(day)]}` : `last: ${n} days ago`;
  };

  return (
    <section>
      <SectionTitle>In the mix</SectionTitle>
      <p className="-mt-1 mb-3 text-xs text-muted">
        Each day one of these is picked at random for everyone, never the same as yesterday. Today&apos;s pick is locked in; changes here count from
        tomorrow. Tap Edit to change a number.
      </p>
      <ul className="divide-y divide-line rounded-3xl border border-line bg-surface/60">
        {mix.map((c) => {
          const when = ago(lastPicked(c.id));
          return (
            <li key={c.id} className="flex items-center gap-3 px-3.5 py-3">
              <span className="text-xl" aria-hidden>
                {c.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="text-xs text-muted">
                  {fmt(c.dailyTarget)} {c.unit} · <span className={when === "today" ? "font-semibold text-volt" : ""}>{when}</span>
                </p>
              </div>
              <button onClick={() => onEdit(c)} className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-2 hover:text-ink">
                Edit
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Suggested challenges not in the club yet. */
function IdeasPanel() {
  const { data, saveChallenge } = useGame();
  const have = new Set(data.challenges.filter((c) => !c.archived).map((c) => c.name.trim().toLowerCase()));
  const ideas = IDEAS.filter((i) => !have.has(i.name.toLowerCase()));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (ideas.length === 0) return null;

  async function add(idea: (typeof IDEAS)[number]) {
    setBusy(idea.name);
    setError(null);
    try {
      await saveChallenge(idea);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add it.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <SectionTitle>Ideas</SectionTitle>
      <p className="-mt-1 mb-3 text-xs text-muted">
        Not in the {data.settings.challengeRotation ? "mix" : "club"} yet. Tap Add to put one in; you can change the number after.
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {ideas.map((idea) => (
          <li key={idea.name} className="flex items-center gap-2 rounded-2xl border border-dashed border-line-strong px-3 py-2.5">
            <span aria-hidden>{idea.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-tight font-semibold">{idea.name}</p>
              <p className="text-[11px] text-muted">
                {fmt(idea.dailyTarget)} {idea.unit}
              </p>
            </div>
            <button
              onClick={() => add(idea)}
              disabled={busy !== null}
              className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-bold text-ink disabled:opacity-50"
              aria-label={`Add ${idea.name}`}
            >
              {busy === idea.name ? "…" : "Add"}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-problem">{error}</p>}
    </section>
  );
}

/** Admin: one rotating challenge a day, or every challenge every day. */
function ModeSwitch() {
  const { data, me, updateSettings } = useGame();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!me?.isOwner) return null;
  const rotation = data.settings.challengeRotation;

  async function set(next: boolean) {
    if (next === rotation || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateSettings({ challengeRotation: next });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change that.");
    } finally {
      setBusy(false);
    }
  }

  const opt = (on: boolean) =>
    `flex-1 rounded-full py-2 text-sm font-bold transition-colors ${on ? "bg-volt text-volt-ink" : "text-muted hover:text-ink"}`;
  return (
    <section>
      <SectionTitle>How challenges run · owner</SectionTitle>
      <div className="flex rounded-full border border-line bg-surface p-1" role="radiogroup" aria-label="Challenge mode">
        <button role="radio" aria-checked={rotation} disabled={busy} onClick={() => set(true)} className={opt(rotation)}>
          Random daily
        </button>
        <button role="radio" aria-checked={!rotation} disabled={busy} onClick={() => set(false)} className={opt(!rotation)}>
          All every day
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        {rotation ? "Everyone does the same one challenge each day, picked at random." : "Every challenge is on, every day."}
      </p>
      {error && <p className="mt-2 text-sm text-problem">{error}</p>}
    </section>
  );
}

function ChallengeSection({ state, rotation, onEdit }: { state: ChallengeState; rotation: boolean; onEdit: () => void }) {
  const { me, data, deleteChallengeLog } = useGame();
  const c = state.challenge;
  const mine = state.players.find((p) => p.player.id === me?.id);
  const days = state.players[0]?.last7.map((d) => d.day) ?? [];
  // Each day's pick (or, before picks were saved, whatever most people logged).
  const dayEmoji = (day: string) => {
    const picked = pickFor(data.challengePicks, data.challenges, day);
    if (picked) return picked.emoji;
    const counts = new Map<string, number>();
    for (const p of state.players) {
      const cid = p.last7.find((x) => x.day === day && x.total > 0)?.challengeId;
      if (cid) counts.set(cid, (counts.get(cid) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return data.challenges.find((x) => x.id === top)?.emoji;
  };
  const [error, setError] = useState<string | null>(null);

  return (
    <section>
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none" aria-hidden>
          {c.emoji}
        </span>
        <div className="min-w-0 flex-1">
          {rotation && <p className="text-[10px] font-bold tracking-wider text-volt uppercase">🎲 Today&apos;s random challenge</p>}
          <h2 className="font-display text-2xl leading-tight font-black">{c.name}</h2>
          <p className="text-sm text-muted">
            {fmt(c.dailyTarget)} {c.unit} {rotation ? "today" : "every day"}
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
        <SectionTitle>{rotation ? "Last 7 days · whatever the day's challenge was" : "Last 7 days"}</SectionTitle>
        <div className="grid gap-y-2.5" style={{ gridTemplateColumns: "minmax(0,1fr) repeat(7, 28px) 36px" }}>
          <span />
          {days.map((d) => (
            <span key={d} className={`flex flex-col items-center text-[10px] font-bold uppercase ${d === days[6] ? "text-volt" : "text-muted"}`}>
              {rotation && (
                <span className="text-xs leading-tight" aria-hidden>
                  {dayEmoji(d)}
                </span>
              )}
              {DAY_SHORT[dayIndex(d)].slice(0, 2)}
            </span>
          ))}
          <span className="text-right text-[10px] font-bold text-muted uppercase">
            <FlameIcon size={11} className="inline" />
          </span>
          {state.players.map((p) => (
            <Row
              key={p.player.id}
              name={p.player.name}
              avatar={<Avatar player={p.player} size={22} />}
              last7={p.last7}
              streak={p.streak}
              unitFor={(d) => data.challenges.find((x) => x.id === (d.challengeId ?? c.id))?.unit ?? c.unit}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Row({
  name,
  avatar,
  last7,
  streak,
  unitFor,
}: {
  name: string;
  avatar: React.ReactNode;
  last7: ChallengeDay[];
  streak: number;
  unitFor: (d: ChallengeDay) => string;
}) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {avatar}
        <span className="truncate text-sm font-semibold">{name}</span>
      </span>
      {last7.map((d) => (
        <DayCell key={d.day} d={d} unit={unitFor(d)} />
      ))}
      <span className={`self-center text-right text-sm font-black tabular ${streak ? "text-ember" : "text-muted"}`}>{streak}</span>
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
