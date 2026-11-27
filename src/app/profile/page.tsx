"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Suspense, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { FlameIcon, GearIcon } from "@/components/Icons";
import { RollingNumber } from "@/components/RollingNumber";
import { Ring, SectionTitle, WeekTag } from "@/components/ui";
import type { PlayerStats } from "@/lib/game";
import { dailyStreaks, lifetimeStats } from "@/lib/challenges";
import { programSummary, runLabel } from "@/lib/programs";
import { formatDistance } from "@/lib/geo";
import { firstToGoal } from "@/lib/season";
import { useGame } from "@/lib/store";
import { playerLine } from "@/lib/trash";
import type { CheckIn } from "@/lib/types";
import { addDays, formatDateTime, localDate, shortDate } from "@/lib/week";

export default function ProfilePage() {
  return (
    <Suspense>
      <Profile />
    </Suspense>
  );
}

function Profile() {
  const { data, game, me, signOut } = useGame();
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? me?.id ?? data.players[0]?.id;
  const player = data.players.find((p) => p.id === id);
  const season = useMemo(() => firstToGoal(game.history, data.checkIns, data.settings.timezone), [game.history, data.checkIns, data.settings.timezone]);
  if (!player) return <p className="py-20 text-center text-muted">Player not found.</p>;

  const st = game.stats[player.id];
  const pw = game.standings.find((s) => s.player.id === player.id)!;
  const isMe = player.id === me?.id;
  const hard = programSummary(data.programs, data.programDays, player.id, game.today);
  const challengeStats = lifetimeStats(data.challenges, data.challengeLogs, player.id, game.today, data.settings.timezone);
  const rotation = data.settings.challengeRotation;
  const daily = dailyStreaks(data.challenges, data.challengeLogs, player.id, game.today);
  const mineAll = data.checkIns.filter((c) => c.userId === player.id);
  const recent = mineAll.slice(-8).reverse();
  // Visits per gym, most-used first
  const gymVisits = Object.entries(
    mineAll.reduce<Record<string, number>>((acc, c) => ((acc[c.gymName] = (acc[c.gymName] ?? 0) + 1), acc), {}),
  ).sort((a, b) => b[1] - a[1]);
  const tz = data.settings.timezone;
  const ctx = { weekStart: game.weekStart, dayIndex: game.dayIndex, daysLeft: game.daysLeft };

  return (
    <div>
      {/* Player switcher */}
      <div className="mb-7 flex items-center justify-between gap-3">
        <div className="no-scrollbar -my-1 flex min-w-0 gap-2 overflow-x-auto py-1 pl-1">
          {data.players.map((p) => (
            <button
              key={p.id}
              onClick={() => router.replace(`/profile?id=${p.id}`)}
              aria-label={p.name}
              aria-pressed={p.id === player.id}
              className={`pressable shrink-0 rounded-full transition-opacity ${p.id === player.id ? "" : "opacity-40 hover:opacity-80"}`}
            >
              <Avatar player={p} size={34} ring={p.id === player.id} />
            </button>
          ))}
        </div>
        {isMe && (
          <Link href="/settings" className="pressable flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)] hover:text-ink">
            <GearIcon size={14} /> Edit
          </Link>
        )}
      </div>

      {/* Hero */}
      <motion.section key={player.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4">
          <Ring value={pw.count} max={pw.required} size={104} stroke={7} color={pw.inDanger ? "var(--color-problem)" : "var(--color-volt)"}>
            <Avatar player={player} size={76} />
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="eyebrow truncate">
              {player.isOwner ? "Club owner" : player.isAdmin ? "Admin" : "Member"} · since {shortDate(localDate(player.createdAt, tz))}
            </p>
            <h1 className="font-big mt-1.5 truncate text-[clamp(44px,14vw,64px)] leading-[0.86]">{player.name}</h1>
            {player.paused && <p className="mt-1.5 font-mono text-[10.5px] tracking-[0.06em] text-muted uppercase">Paused · weeks don&apos;t count</p>}
          </div>
        </div>
        <div className="mt-5 flex items-center gap-4 border-y border-line py-4">
          <div className="shrink-0">
            <p className="eyebrow">This week</p>
            <p className="font-big mt-1 flex items-end text-[44px] leading-[0.85]">
              <RollingNumber value={pw.count} />
              <span className="text-[22px] text-faint">/{pw.required}</span>
            </p>
            <div className="mt-1.5">
              <WeekTag pw={pw} />
            </div>
          </div>
          <p className="min-w-0 flex-1 text-right text-[13.5px] leading-snug text-ink-2">{playerLine(pw, ctx, isMe)}</p>
        </div>
      </motion.section>

      {/* Streak */}
      <section className="mt-6 flex items-center justify-between rounded-[22px] bg-[linear-gradient(120deg,rgb(255_178_107/0.12),transparent_70%)] px-5 py-4 shadow-[inset_0_0_0_1px_rgb(255_178_107/0.18)]">
        <div>
          <p className="eyebrow !text-ember">Current streak</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="font-big text-[64px] leading-[0.85]">
              <RollingNumber value={st.currentStreak} />
            </span>
            <span className="font-display text-lg font-extrabold">week{st.currentStreak === 1 ? "" : "s"}</span>
          </p>
          {st.streakIncludesThisWeek && <p className="mt-1.5 text-[11.5px] text-ember/80">Includes this week. Locked in.</p>}
        </div>
        <div className="flex flex-col items-end">
          <FlameIcon size={44} strokeWidth={1.6} className={st.currentStreak ? "text-ember" : "text-faint"} />
          <p className="eyebrow mt-2">Best {st.bestStreak}</p>
        </div>
      </section>

      {/* Stats */}
      <dl className="mt-6">
        <StatRow label="Total check-ins" value={st.total} />
        <StatRow label="First in" hint="weeks hitting the goal before anyone" value={season.wins[player.id] ?? 0} tone={season.wins[player.id] ?? 0 ? "volt" : undefined} />
        <StatRow label="Weeks completed" value={st.weeksCompleted} tone={st.weeksCompleted ? "volt" : undefined} />
        <StatRow label="Weeks failed" value={st.weeksFailed} tone={st.weeksFailed ? "problem" : undefined} />
        <StatRow label="Solo fails" hint="only one who missed" value={st.soloFails} tone={st.soloFails ? "problem" : undefined} />
        <StatRow
          label="Success rate"
          value={st.weeksCompleted + st.weeksFailed ? Math.round((st.weeksCompleted / (st.weeksCompleted + st.weeksFailed)) * 100) : 0}
          suffix="%"
        />
      </dl>

      {(hard.attempts > 0 || isMe) && (
        <section className="mt-8">
          <SectionTitle right={<Link href="/hard" className="text-[11px] font-semibold text-muted hover:text-ink">75 Hard →</Link>}>
            75 Hard
          </SectionTitle>

          {hard.active.length === 0 ? (
            <Link href="/hard" className="block rounded-2xl border border-dashed border-line-strong px-4 py-3.5 text-sm text-muted hover:text-ink">
              {isMe ? "🔥 Not on a run. Start 75 Hard, 75 Soft or a 30/35-day run →" : `${player.name} isn't on a run right now.`}
            </Link>
          ) : (
            <ul className="space-y-3">
              {hard.active.map((r) => {
                const p = r.program;
                const ticked = r.doneToday.filter((id) => p.tasks.some((t) => t.id === id)).length;
                const pct = Math.min(1, r.completeDays / p.lengthDays);
                const bad = !!r.failedOn;
                return (
                  <li key={p.id}>
                    <Link
                      href="/hard"
                      className={`block rounded-2xl border p-4 ${bad ? "border-problem/30 bg-problem/[0.06]" : "border-ember/20 bg-[linear-gradient(120deg,rgb(255_178_107/0.10),transparent_70%)]"}`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-display text-xl font-black">
                          {p.name}
                          {p.attempt > 1 && <span className="ml-1.5 text-xs font-semibold text-muted">attempt #{p.attempt}</span>}
                        </span>
                        <span className={`text-sm font-semibold ${bad ? "text-problem" : "text-ink-2"}`}>{runLabel(r)}</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct * 100}%`, background: bad ? "var(--color-problem)" : p.strict ? "var(--color-close)" : "var(--color-volt)" }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted">
                        {r.completeDays} of {p.lengthDays} days done
                        {r.missedDays > 0 && ` · ${r.missedDays} missed`}
                        {r.started && !bad && (r.todayComplete ? " · ✓ today done" : ` · today ${ticked}/${p.tasks.length}`)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {hard.attempts > 0 && (
            <dl className="mt-3 grid grid-cols-4 gap-3 rounded-2xl border border-line bg-surface/50 p-4">
              <MiniStat label="Completed" value={String(hard.completed)} tone={hard.completed ? "safe" : undefined} />
              <MiniStat label="Attempts" value={String(hard.attempts)} />
              <MiniStat label="Days done" value={String(hard.totalDays)} />
              <MiniStat label="Best run" value={hard.best ? `${hard.best.days}d` : "–"} />
            </dl>
          )}
          {hard.past.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              Past:{" "}
              {hard.past
                .slice(0, 4)
                .map((r) =>
                  r.program.status === "completed"
                    ? `${r.program.name} ✓`
                    : r.program.status === "failed"
                      ? `${r.program.name} ✕ Day ${r.failedOn?.n ?? "?"}`
                      : `${r.program.name} (quit)`,
                )
                .join(" · ")}
            </p>
          )}
        </section>
      )}

      {challengeStats.length > 0 && (
        <section className="mt-8">
          <SectionTitle right={<Link href="/challenges" className="text-[11px] font-semibold text-muted hover:text-ink">All →</Link>}>
            Daily challenges
          </SectionTitle>
          {rotation && (
            <div className="mb-3 rounded-2xl border border-line bg-surface/50 p-4">
              <dl className="grid grid-cols-3 gap-3">
                <MiniStat label="Days in a row" value={String(daily.current)} flame={daily.current > 0} />
                <MiniStat label="Best run" value={String(daily.best)} />
                <MiniStat label="Today" value={daily.doneToday ? "✓" : "–"} tone={daily.doneToday ? "safe" : undefined} />
              </dl>
              <p className="mt-2 text-xs text-muted">Whatever the day&apos;s challenge is, it counts toward the run.</p>
            </div>
          )}
          <ul className="space-y-3">
            {challengeStats.map((cs) => (
              <li key={cs.challenge.id} className="rounded-2xl border border-line bg-surface/50 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl" aria-hidden>
                    {cs.challenge.emoji}
                  </span>
                  <span className="flex-1 font-display text-lg font-extrabold">
                    {cs.challenge.name}
                    {cs.challenge.archived && <span className="ml-2 text-[10px] font-bold tracking-wider text-muted">RETIRED</span>}
                  </span>
                  <span className="text-xs text-muted">
                    {cs.challenge.dailyTarget.toLocaleString("en-US")} {cs.challenge.unit}
                    {rotation ? "" : "/day"}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-3">
                  <MiniStat label={`Total ${cs.challenge.unit}`} value={cs.total.toLocaleString("en-US")} />
                  <MiniStat label="Days done" value={String(cs.daysCompleted)} tone={cs.daysCompleted ? "safe" : undefined} />
                  <MiniStat label="Best day" value={cs.bestDay.toLocaleString("en-US")} />
                </dl>
                {!rotation && (
                  <p className="mt-2 text-xs text-muted">
                    {cs.currentStreak > 0 ? `🔥 ${cs.currentStreak} in a row · ` : ""}Best: {cs.bestStreak} day{cs.bestStreak === 1 ? "" : "s"} in a row
                    {!cs.challenge.archived && (cs.doneToday ? " · ✓ done today" : " · not done today yet")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {gymVisits.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Gyms</SectionTitle>
          <ul className="space-y-2">
            {gymVisits.map(([name, n], i) => (
              <li key={name} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {name}
                  {i === 0 && gymVisits.length > 1 && <span className="ml-1.5 text-[10px] font-bold tracking-wider text-volt">HOME GYM</span>}
                </span>
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
                  <span className="block h-full rounded-full bg-ink-2" style={{ width: `${(n / gymVisits[0][1]) * 100}%` }} />
                </span>
                <span className="tabular w-8 text-right text-xs text-muted">{n}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Consistency */}
      <section className="mt-8">
        <SectionTitle>Consistency</SectionTitle>
        <Consistency checkIns={mineAll} weekStart={game.weekStart} today={game.today} tz={tz} />
      </section>

      {/* Weekly chart */}
      <section className="mt-8">
        <SectionTitle>Last 12 weeks</SectionTitle>
        <WeeklyBars timeline={st.timeline} />
      </section>

      {/* Recent */}
      <section className="mt-8">
        <SectionTitle>Recent check-ins</SectionTitle>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">Not a single check-in. Incredible.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((c) => (
              <li key={c.id}>
                <Link href={`/map?checkin=${c.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors active:bg-white/[0.02]">
                  <span className="min-w-0">
                    {c.gymName}
                    {c.distanceM != null && <span className="text-xs text-muted"> · {formatDistance(c.distanceM)} from gym</span>}
                    {c.manual && <span className="ml-1.5 font-mono text-[9.5px] tracking-[0.06em] text-muted uppercase">Manual</span>}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted tabular">{formatDateTime(c.checkedInAt, tz)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isMe && (
        <button onClick={signOut} className="mt-10 w-full rounded-2xl border border-line py-3 text-sm font-semibold text-muted hover:text-ink">
          Sign out
        </button>
      )}
    </div>
  );
}

function StatRow({ label, value, suffix, tone, hint }: { label: string; value: number; suffix?: string; tone?: "volt" | "problem"; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3">
      <dt className="min-w-0">
        <span className="eyebrow">{label}</span>
        {hint && <span className="ml-2 text-[11.5px] text-faint">{hint}</span>}
      </dt>
      <dd className="font-big shrink-0 text-[36px] leading-[0.85]" style={tone ? { color: `var(--color-${tone})` } : undefined}>
        {value}
        {suffix && <span className="ml-0.5 text-[18px] text-muted">{suffix}</span>}
      </dd>
    </div>
  );
}

function MiniStat({ label, value, tone, flame }: { label: string; value: string; tone?: "safe"; flame?: boolean }) {
  return (
    <div>
      <dt className="eyebrow truncate !text-[10px]">{label}</dt>
      <dd
        className={`font-big mt-0.5 flex items-center gap-1 text-[28px] leading-none ${flame ? "text-ember" : ""}`}
        style={tone ? { color: `var(--color-${tone})` } : undefined}
      >
        {value}
        {flame && <FlameIcon size={16} strokeWidth={2.2} />}
      </dd>
    </div>
  );
}

/** Bars per finished week with the requirement as a dashed line. Tap a bar for details. */
function WeeklyBars({ timeline }: { timeline: PlayerStats["timeline"] }) {
  const weeks = timeline.slice(-12);
  const [sel, setSel] = useState<number | null>(null);
  if (weeks.length === 0) return <p className="text-sm text-muted">No finished weeks yet.</p>;
  const req = weeks[weeks.length - 1].requirement;
  const max = Math.max(req + 1, ...weeks.map((w) => w.count));
  const H = 120;
  const active = sel != null ? weeks[sel] : weeks[weeks.length - 1];

  return (
    <div>
      <p className="mb-3 text-sm">
        <span className="text-muted">Week of {shortDate(active.weekStart)}: </span>
        <b className="tabular">
          {active.count}/{active.requirement}
        </b>{" "}
        <span className={active.completed ? "text-safe" : "text-problem"}>{active.completed ? "✓ Safe" : "✕ Missed — group punished"}</span>
      </p>
      <div className="relative" style={{ height: H }}>
        <div
          className="absolute inset-x-0 border-t border-dashed border-ink-2/40"
          style={{ bottom: (req / max) * H }}
          aria-hidden
        >
          <span className="absolute -top-4 right-0 text-[10px] text-muted">goal {req}</span>
        </div>
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {weeks.map((w, i) => (
            <button
              key={w.weekStart}
              onClick={() => setSel(i)}
              onMouseEnter={() => setSel(i)}
              className="group flex h-full flex-1 items-end justify-center"
              aria-label={`Week of ${shortDate(w.weekStart)}: ${w.count} of ${w.requirement}, ${w.completed ? "safe" : "failed"}`}
            >
              <span
                className="w-full max-w-[22px] rounded-t-[4px] transition-opacity"
                style={{
                  height: Math.max(3, (w.count / max) * H),
                  background: w.completed ? "var(--color-safe)" : "var(--color-problem)",
                  opacity: sel == null || sel === i ? 1 : 0.4,
                }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px] border-t border-line pt-1.5">
        {weeks.map((w, i) => (
          <span key={w.weekStart} className="flex-1 text-center text-[9px] text-muted">
            {i % 3 === 0 || i === weeks.length - 1 ? shortDate(w.weekStart).replace(" ", " ") : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Every day of the last 12 weeks: lime where you went (brighter for doubles), today ringed. */
function Consistency({ checkIns, weekStart, today, tz }: { checkIns: CheckIn[]; weekStart: string; today: string; tz: string }) {
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(weekStart, -7 * (11 - i)));
  const perDay = new Map<string, number>();
  for (const c of checkIns) {
    const d = localDate(c.checkedInAt, tz);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  const daysWent = weeks.reduce((n, w) => n + Array.from({ length: 7 }, (_, i) => addDays(w, i)).filter((d) => (perDay.get(d) ?? 0) > 0).length, 0);
  return (
    <div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between py-[3px] font-mono text-[9px] text-faint" aria-hidden>
          <span>M</span>
          <span>W</span>
          <span>F</span>
          <span>S</span>
        </div>
        <div className="grid flex-1 grid-cols-12 gap-[3px]" role="img" aria-label={`Went to the gym on ${daysWent} days in the last 12 weeks`}>
          {weeks.map((w) => (
            <div key={w} className="grid grid-rows-7 gap-[3px]">
              {Array.from({ length: 7 }, (_, i) => {
                const d = addDays(w, i);
                const n = perDay.get(d) ?? 0;
                const future = d > today;
                return (
                  <span
                    key={d}
                    title={`${shortDate(d)}: ${n} check-in${n === 1 ? "" : "s"}`}
                    className={`aspect-square rounded-[3px] ${
                      future ? "bg-transparent" : n >= 2 ? "bg-volt" : n === 1 ? "bg-volt/65" : "bg-surface-2"
                    } ${d === today ? "ring-[1.5px] ring-ink/70" : ""}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between pl-5 font-mono text-[9.5px] tracking-[0.06em] text-faint uppercase">
        <span>{shortDate(weeks[0])}</span>
        <span className="text-muted">
          <b className="font-medium text-ink-2">{daysWent}</b> days went
        </span>
        <span>This week</span>
      </div>
    </div>
  );
}
