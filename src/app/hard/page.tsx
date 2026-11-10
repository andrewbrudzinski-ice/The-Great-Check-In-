"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Confetti } from "@/components/Confetti";
import { CheckIcon, FlameIcon } from "@/components/Icons";
import { PageTitle, Ring, SectionTitle, Sheet } from "@/components/ui";
import { computeRun, LENGTHS, PRESETS, programName, runLabel, type Preset, type RunState } from "@/lib/programs";
import { useGame } from "@/lib/store";
import type { Player, Program, ProgramTask } from "@/lib/types";
import { formatTime, localDate, shortDate } from "@/lib/week";

export default function HardPage() {
  const { data, game, me } = useGame();
  const [starting, setStarting] = useState<{ preset: Preset; length?: number; restartOf?: Program } | null>(null);
  const today = game.today;

  const runs = useMemo(
    () => data.programs.map((p) => computeRun(p, data.programDays, today)),
    [data.programs, data.programDays, today],
  );
  const mine = runs.filter((r) => r.program.userId === me?.id && r.program.status === "active");
  const squad = runs.filter((r) => r.program.status === "active" && r.program.userId !== me?.id);
  const past = runs
    .filter((r) => r.program.status !== "active")
    .sort((a, b) => (b.program.endedAt ?? "").localeCompare(a.program.endedAt ?? ""));
  const player = (id: string) => data.players.find((p) => p.id === id);

  return (
    <div>
      <PageTitle eyebrow="No days off" title="75 Hard" />

      {mine.length === 0 ? (
        <StartPicker onPick={(preset) => setStarting({ preset })} />
      ) : (
        <div className="space-y-8">
          {mine.map((r) => (
            <MyRun
              key={r.program.id}
              run={r}
              onRestart={() => setStarting({ preset: presetFor(r.program), length: r.program.lengthDays, restartOf: r.program })}
            />
          ))}
          {mine.length < 3 && (
            <button
              onClick={() => setStarting({ preset: PRESETS[0] })}
              className="w-full rounded-2xl border border-dashed border-line-strong py-3 text-sm font-semibold text-muted hover:text-ink"
            >
              + Start another run
            </button>
          )}
        </div>
      )}

      <section className="mt-12">
        <SectionTitle>The squad</SectionTitle>
        {squad.length === 0 ? (
          <p className="text-sm text-muted">Nobody else is on a run right now. Peer pressure them.</p>
        ) : (
          <ul className="space-y-2">
            {squad.map((r) => {
              const p = player(r.program.userId);
              return p ? <SquadRow key={r.program.id} run={r} player={p} /> : null;
            })}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-12">
          <SectionTitle>Past runs</SectionTitle>
          <ul className="divide-y divide-line">
            {past.map((r) => {
              const p = player(r.program.userId);
              if (!p) return null;
              const st = r.program.status;
              return (
                <li key={r.program.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <Avatar player={p} size={26} />
                  <span className="min-w-0 flex-1">
                    <b className="font-semibold">{p.name}</b> <span className="text-muted">· {r.program.name}</span>
                    {r.program.attempt > 1 && <span className="text-muted"> · attempt #{r.program.attempt}</span>}
                    <span className="block text-xs text-muted">Started {shortDate(r.program.startDate)}</span>
                  </span>
                  <span
                    className={`shrink-0 font-display text-[11px] font-black tracking-wider ${
                      st === "completed" ? "text-safe" : st === "failed" ? "text-problem" : "text-muted"
                    }`}
                  >
                    {st === "completed"
                      ? r.program.strict
                        ? "COMPLETED 🏆"
                        : `DONE ${r.completeDays}/${r.program.lengthDays}`
                      : st === "failed"
                        ? `FAILED DAY ${r.failedOn?.n ?? "?"}`
                        : `QUIT ON DAY ${Math.max(1, r.dayNumber)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="mt-12 text-center text-[11px] text-muted">
        Honor system. Yesterday stays tickable until it ends. After that it locks. Hard rules: a locked day with anything unticked
        means back to Day 1.
      </p>

      <Sheet open={!!starting} onClose={() => setStarting(null)}>
        {starting && (
          <StartForm
            preset={starting.preset}
            initialLength={starting.length}
            restartOf={starting.restartOf}
            onDone={() => setStarting(null)}
          />
        )}
      </Sheet>
    </div>
  );
}

function presetFor(p: Program): Preset {
  return PRESETS.find((x) => x.strict === p.strict) ?? PRESETS[0];
}

/* ------------------------------------------------------------------ */

function StartPicker({ onPick }: { onPick: (p: Preset) => void }) {
  return (
    <div>
      <p className="mb-4 text-sm text-ink-2">Pick your rules, then your length: 30, 35, 75 or anything you like.</p>
      <div className="space-y-3">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPick(p)}
            className={`block w-full rounded-3xl border p-5 text-left transition-colors ${
              p.strict ? "border-problem/30 bg-[linear-gradient(150deg,rgba(251,65,102,0.12),transparent_60%)]" : "border-line bg-surface/60"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span className="font-display text-3xl font-black">75 {p.title}</span>
              <span className="text-xs font-semibold text-muted">or 30 / 35 →</span>
            </div>
            <p className={`mt-1 text-sm font-semibold ${p.strict ? "text-problem" : "text-ink-2"}`}>{p.blurb}</p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {p.tasks.map((t) => (
                <li key={t.id}>
                  <span className="mr-2">{t.emoji}</span>
                  {t.label}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </div>
  );
}

const field = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink outline-none placeholder:text-muted/60 focus:border-volt/60";

function StartForm({
  preset,
  initialLength,
  restartOf,
  onDone,
}: {
  preset: Preset;
  initialLength?: number;
  restartOf?: Program;
  onDone: () => void;
}) {
  const { startProgram, endProgram } = useGame();
  const [strict, setStrict] = useState(preset.strict);
  const [length, setLength] = useState(initialLength ?? 75);
  const [custom, setCustom] = useState(!LENGTHS.includes(initialLength ?? 75));
  const [tasks, setTasks] = useState<ProgramTask[]>(restartOf?.tasks ?? preset.tasks);
  const [tomorrow, setTomorrow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = programName(length, strict);
  const ok = length >= 7 && length <= 365 && tasks.length >= 1 && tasks.every((t) => t.label.trim());

  function switchRules(s: boolean) {
    setStrict(s);
    if (!restartOf) setTasks((PRESETS.find((p) => p.strict === s) ?? preset).tasks);
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      if (restartOf) await endProgram(restartOf.id, "failed");
      await startProgram({
        name,
        strict,
        lengthDays: length,
        tasks: tasks.map((t) => ({ ...t, label: t.label.trim() })),
        startTomorrow: tomorrow,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start.");
    } finally {
      setBusy(false);
    }
  }

  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-2 text-sm font-semibold ${active ? "bg-ink text-bg" : "bg-surface-2 text-ink-2"}`;

  return (
    <div className="pb-1">
      <h3 className="font-display text-3xl font-black">{restartOf ? `Back to Day 1` : `Start ${name}`}</h3>
      {restartOf && <p className="mt-1 text-sm text-muted">Attempt #{restartOf.attempt + 1}. Same rules, clean slate.</p>}

      <div className="mt-5 space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold text-ink-2">Rules</p>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button key={p.key} onClick={() => switchRules(p.strict)} className={`rounded-2xl px-3 py-3 text-left ${strict === p.strict ? "bg-ink text-bg" : "bg-surface-2"}`}>
                <span className="block font-display font-black">{p.title}</span>
                <span className={`block text-xs ${strict === p.strict ? "text-bg/70" : "text-muted"}`}>{p.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-ink-2">Length</p>
          <div className="flex flex-wrap items-center gap-2">
            {LENGTHS.map((n) => (
              <button
                key={n}
                onClick={() => {
                  setLength(n);
                  setCustom(false);
                }}
                className={chip(!custom && length === n)}
              >
                {n} days
              </button>
            ))}
            <button onClick={() => setCustom(true)} className={chip(custom)}>
              Custom
            </button>
            {custom && (
              <input
                type="number"
                inputMode="numeric"
                min={7}
                max={365}
                value={length}
                onChange={(e) => setLength(Math.round(Number(e.target.value)) || 0)}
                className="w-20 rounded-xl border border-line bg-surface px-3 py-2 text-ink outline-none focus:border-volt/60"
                aria-label="Number of days"
              />
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-ink-2">Every day</p>
          <ul className="space-y-2">
            {tasks.map((t, i) => (
              <li key={t.id} className="flex items-center gap-2">
                <span className="w-7 text-center text-lg">{t.emoji}</span>
                <input
                  className={field}
                  value={t.label}
                  maxLength={80}
                  onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  aria-label={`Task ${i + 1}`}
                />
                <button
                  onClick={() => setTasks(tasks.filter((_, j) => j !== i))}
                  disabled={tasks.length <= 1}
                  className="px-2 text-lg text-muted hover:text-problem disabled:opacity-30"
                  aria-label={`Remove ${t.label}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {tasks.length < 10 && (
            <button
              onClick={() => setTasks([...tasks, { id: `custom-${Date.now().toString(36)}`, emoji: "✅", label: "" }])}
              className="mt-2 text-sm font-semibold text-muted hover:text-ink"
            >
              + Add a task
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setTomorrow(false)} className={chip(!tomorrow)}>
            Start today
          </button>
          <button onClick={() => setTomorrow(true)} className={chip(tomorrow)}>
            Start tomorrow
          </button>
        </div>

        {error && <p className="text-sm text-problem">{error}</p>}
        <button
          onClick={start}
          disabled={busy || !ok}
          className={`w-full rounded-2xl py-4 font-display text-lg font-black tracking-wide disabled:bg-surface-3 disabled:text-muted ${
            strict ? "bg-problem text-white" : "bg-volt text-volt-ink"
          }`}
        >
          {busy ? "Starting…" : `Start ${name}`}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MyRun({ run, onRestart }: { run: RunState; onRestart: () => void }) {
  const { endProgram, data, me, game } = useGame();
  const p = run.program;
  const [celebrate, setCelebrate] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Gym check-in today, shown next to workout tasks.
  const gymToday = data.checkIns.find((c) => c.userId === me?.id && localDate(c.checkedInAt, data.settings.timezone) === game.today);

  async function end(status: "completed" | "failed" | "quit") {
    setError(null);
    try {
      await endProgram(p.id, status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    }
  }

  const ringColor = run.failedOn ? "var(--color-problem)" : run.completed ? "var(--color-safe)" : p.strict ? "var(--color-close)" : "var(--color-volt)";

  return (
    <section className="relative">
      {celebrate > 0 && <Confetti key={celebrate} count={40} spread={260} />}
      <div className="flex items-center gap-5">
        <Ring value={run.completeDays} max={p.lengthDays} size={112} stroke={9} color={ringColor}>
          <div className="text-center">
            <p className="font-display tabular text-3xl leading-none font-black">{Math.max(run.dayNumber, 0)}</p>
            <p className="text-[10px] font-semibold tracking-wider text-muted uppercase">of {p.lengthDays}</p>
          </div>
        </Ring>
        <div className="min-w-0">
          <p className="eyebrow">{p.strict ? "Hard rules" : "Soft rules"}</p>
          <h2 className="font-display text-3xl leading-none font-black">{p.name}</h2>
          <p className="mt-1.5 text-sm text-ink-2">{runLabel(run)}</p>
          <p className="mt-0.5 text-xs text-muted">
            {run.completeDays} done{run.missedDays ? ` · ${run.missedDays} missed` : ""}
            {p.attempt > 1 && ` · attempt #${p.attempt}`}
          </p>
        </div>
      </div>

      {run.failedOn ? (
        <div className="mt-5 rounded-3xl border border-problem/30 bg-problem/[0.08] p-5">
          <p className="font-display text-2xl font-black text-problem">Day {run.failedOn.n} was missed.</p>
          <p className="mt-1 text-sm text-ink-2">Hard rules: back to Day 1. No shame. Okay, a little shame.</p>
          <div className="mt-4 flex gap-2">
            <button onClick={onRestart} className="flex-1 rounded-2xl bg-ink py-3 font-display font-black text-bg">
              Restart at Day 1
            </button>
            <button
              onClick={() => confirm(`End ${p.name} as failed on Day ${run.failedOn?.n}?`) && end("failed")}
              className="rounded-2xl px-4 text-sm font-semibold text-muted"
            >
              End run
            </button>
          </div>
        </div>
      ) : run.finished ? (
        <div className="mt-5 rounded-3xl bg-volt p-5 text-volt-ink">
          <p className="font-display text-3xl leading-none font-black">{p.strict ? `${p.name.toUpperCase()}: COMPLETE 🏆` : "FINISHED."}</p>
          <p className="mt-2 text-sm font-medium opacity-75">
            {p.strict ? `${p.lengthDays} days. Zero misses. Legend.` : `${run.completeDays} of ${p.lengthDays} days done.`}
          </p>
          <button onClick={() => end("completed")} className="mt-4 rounded-2xl bg-volt-ink px-5 py-3 font-display font-black text-volt">
            Lock it in
          </button>
        </div>
      ) : !run.started ? (
        <p className="mt-5 rounded-2xl border border-line px-4 py-3 text-sm text-ink-2">Starts tomorrow. Get your gallon ready. 💧</p>
      ) : (
        <>
          {run.yesterday && !run.yesterday.complete && (
            <div className="mt-5 rounded-3xl border border-one/30 bg-one/[0.06] p-4">
              <p className="text-sm font-semibold text-one">
                Yesterday (Day {Math.max(1, run.dayNumber - 1)}) isn&apos;t finished. You can still tick it until midnight.
              </p>
              <Checklist program={p} day={run.yesterday.day} done={run.yesterday.done} />
            </div>
          )}
          <div className="mt-5">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="eyebrow">Today · Day {run.dayNumber}</p>
              <p className="text-xs text-muted tabular">
                {run.doneToday.filter((id) => p.tasks.some((t) => t.id === id)).length}/{p.tasks.length}
              </p>
            </div>
            <Checklist
              program={p}
              day={game.today}
              done={run.doneToday}
              gymNote={gymToday ? `Gym check-in ${formatTime(gymToday.checkedInAt, data.settings.timezone)}` : undefined}
              onAllDone={() => {
                setCelebrate((n) => n + 1);
                navigator.vibrate?.([20, 40, 60]);
              }}
            />
            {run.todayComplete && (
              <motion.p initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-3 text-center font-display text-lg font-black text-safe">
                DAY {run.dayNumber} DONE ✓
              </motion.p>
            )}
          </div>
        </>
      )}

      <div className="mt-6">
        <Calendar run={run} />
      </div>

      {error && <p className="mt-2 text-sm text-problem">{error}</p>}
      {!run.failedOn && !run.finished && (
        <button onClick={() => confirm(`Quit ${p.name}? It'll show as quit on Day ${Math.max(1, run.dayNumber)}.`) && end("quit")} className="mt-4 text-xs font-semibold text-muted hover:text-problem">
          Quit this run
        </button>
      )}
    </section>
  );
}

function Checklist({
  program,
  day,
  done,
  gymNote,
  onAllDone,
}: {
  program: Program;
  day: string;
  done: string[];
  gymNote?: string;
  onAllDone?: () => void;
}) {
  const { toggleProgramTask } = useGame();
  const [error, setError] = useState<string | null>(null);
  const set = new Set(done);

  async function toggle(id: string) {
    setError(null);
    const next = !set.has(id);
    const willComplete = next && program.tasks.every((t) => t.id === id || set.has(t.id));
    navigator.vibrate?.(8);
    try {
      await toggleProgramTask(program.id, day, id, next);
      if (willComplete) onAllDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    }
  }

  return (
    <div>
      <ul className="space-y-2">
        {program.tasks.map((t) => {
          const on = set.has(t.id);
          const isWorkout = /workout/i.test(t.label) || t.id.startsWith("workout");
          return (
            <li key={t.id}>
              <button
                onClick={() => toggle(t.id)}
                aria-pressed={on}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                  on ? "border-safe/30 bg-safe/[0.08]" : "border-line bg-surface/60 active:bg-surface-2"
                }`}
              >
                <span className="text-xl">{t.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[15px] font-medium ${on ? "text-ink-2 line-through decoration-safe/60" : ""}`}>{t.label}</span>
                  {isWorkout && gymNote && <span className="block text-xs text-safe">✓ {gymNote}</span>}
                </span>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${on ? "border-safe bg-safe text-bg" : "border-line-strong"}`}>
                  <AnimatePresence>
                    {on && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <CheckIcon size={16} strokeWidth={3} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-sm text-problem">{error}</p>}
    </div>
  );
}

const CELL: Record<string, string> = {
  done: "bg-safe",
  missed: "bg-problem",
  "partial-open": "bg-one",
  today: "bg-surface-3 ring-2 ring-volt",
  future: "bg-surface-2",
};

function Calendar({ run, compact = false }: { run: RunState; compact?: boolean }) {
  const cols = run.program.lengthDays > 40 ? 15 : 10;
  return (
    <div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {run.calendar.map((c) => (
          <span
            key={c.day}
            className={`aspect-square rounded-[4px] ${CELL[c.state]}`}
            title={`Day ${c.n} · ${shortDate(c.day)} · ${c.state === "done" ? "done" : c.state === "missed" ? "missed" : c.state === "future" ? "upcoming" : `${c.ticked}/${run.program.tasks.length}`}`}
          />
        ))}
      </div>
      {!compact && (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
          <Legend className="bg-safe" label="done" />
          <Legend className="bg-one" label="yesterday, still open" />
          <Legend className="bg-problem" label="missed" />
          <Legend className="bg-surface-3 ring-1 ring-volt" label="today" />
        </p>
      )}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2 w-2 rounded-[2px] ${className}`} />
      {label}
    </span>
  );
}

function SquadRow({ run, player }: { run: RunState; player: Player }) {
  const [open, setOpen] = useState(false);
  const p = run.program;
  const ticked = run.doneToday.filter((id) => p.tasks.some((t) => t.id === id)).length;
  return (
    <li className="rounded-2xl border border-line bg-surface/50">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={open}>
        <Avatar player={player} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">
            {player.name} <span className="font-normal text-muted">· {p.name}</span>
            {p.attempt > 1 && <span className="ml-1 text-xs text-muted">#{p.attempt}</span>}
          </span>
          <span className={`block text-xs ${run.failedOn ? "text-problem" : "text-muted"}`}>{runLabel(run)}</span>
        </span>
        <span className="text-right">
          {run.failedOn ? (
            <span className="text-lg">💀</span>
          ) : run.todayComplete ? (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-safe">
              <CheckIcon size={14} strokeWidth={3} /> today
            </span>
          ) : run.started ? (
            <span className="tabular text-sm text-muted">
              {ticked}/{p.tasks.length}
            </span>
          ) : null}
          {run.completeDays > 0 && !run.failedOn && (
            <span className="flex items-center justify-end gap-0.5 text-[11px] font-bold text-orange-300">
              <FlameIcon size={11} strokeWidth={2.4} />
              {run.completeDays}
            </span>
          )}
        </span>
      </button>
      {open && (
        <div className="border-t border-line p-3">
          <Calendar run={run} compact />
        </div>
      )}
    </li>
  );
}
