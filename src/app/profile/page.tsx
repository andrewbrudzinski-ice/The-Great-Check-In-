"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Suspense, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { GearIcon } from "@/components/Icons";
import { Ring, SectionTitle, StatusPill } from "@/components/ui";
import type { PlayerStats } from "@/lib/game";
import { STATUS_META } from "@/lib/game";
import { formatDistance } from "@/lib/geo";
import { useGame } from "@/lib/store";
import { playerLine } from "@/lib/trash";
import { formatDateTime, shortDate } from "@/lib/week";

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
  if (!player) return <p className="py-20 text-center text-muted">Player not found.</p>;

  const st = game.stats[player.id];
  const pw = game.standings.find((s) => s.player.id === player.id)!;
  const isMe = player.id === me?.id;
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
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          {data.players.map((p) => (
            <button
              key={p.id}
              onClick={() => router.replace(`/profile?id=${p.id}`)}
              aria-label={p.name}
              aria-pressed={p.id === player.id}
              className={`rounded-full transition-opacity ${p.id === player.id ? "" : "opacity-40 hover:opacity-80"}`}
            >
              <Avatar player={p} size={34} ring={p.id === player.id} />
            </button>
          ))}
        </div>
        {isMe && (
          <Link href="/settings" className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-2 hover:text-ink">
            <GearIcon size={14} /> Edit
          </Link>
        )}
      </div>

      {/* Hero */}
      <motion.section key={player.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-5">
        <Ring value={pw.count} max={pw.required} size={128} stroke={9} color={STATUS_META[pw.status].color}>
          <Avatar player={player} size={92} />
        </Ring>
        <div className="min-w-0">
          <h1 className="font-display truncate text-4xl leading-none font-black">{player.name}</h1>
          <p className="font-display tabular mt-2 text-xl font-extrabold">
            {pw.count}
            <span className="text-muted">/{pw.required}</span> <span className="text-sm font-semibold text-muted">this week</span>
          </p>
          <div className="mt-2">
            <StatusPill status={pw.status} />
          </div>
          <p className="mt-2 text-xs text-muted">{playerLine(pw, ctx, isMe)}</p>
        </div>
      </motion.section>

      {/* Streak */}
      <section className="mt-8 flex items-center justify-between rounded-3xl border border-orange-400/20 bg-[linear-gradient(120deg,rgba(251,146,60,0.12),transparent_70%)] px-5 py-4">
        <div>
          <p className="eyebrow text-orange-300/80">Current streak</p>
          <p className="mt-1 flex items-baseline gap-2">
            <motion.span
              key={st.currentStreak}
              initial={{ scale: 1.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-display tabular text-5xl leading-none font-black"
            >
              {st.currentStreak}
            </motion.span>
            <span className="font-display text-lg font-bold">WEEK{st.currentStreak === 1 ? "" : "S"}</span>
          </p>
          {st.streakIncludesThisWeek && <p className="mt-1 text-[11px] text-orange-200/70">Includes this week. Locked in.</p>}
        </div>
        <span className="text-5xl" aria-hidden>
          {st.currentStreak >= 6 ? "🔥🔥" : st.currentStreak > 0 ? "🔥" : "🧊"}
        </span>
      </section>

      {/* Stats */}
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-b border-line pb-6">
        <BigStat label="Total check-ins" value={st.total} />
        <BigStat label="Best streak" value={st.bestStreak} suffix="wks" />
        <BigStat label="Weeks completed" value={st.weeksCompleted} tone="safe" />
        <BigStat label="Weeks failed" value={st.weeksFailed} tone={st.weeksFailed ? "problem" : undefined} />
        <BigStat label="Punishments caused" value={st.punishmentsCaused} tone={st.punishmentsCaused ? "problem" : undefined} />
        <BigStat
          label="Success rate"
          value={st.weeksCompleted + st.weeksFailed ? Math.round((st.weeksCompleted / (st.weeksCompleted + st.weeksFailed)) * 100) : 0}
          suffix="%"
        />
      </dl>

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
                <Link href={`/map?checkin=${c.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    {c.gymName}
                    {c.distanceM != null && <span className="text-xs text-muted"> · ✓ {formatDistance(c.distanceM)} from gym</span>}
                    {c.manual && <span className="text-xs text-one"> · ✍️ added by admin</span>}
                  </span>
                  <span className="tabular text-xs text-muted">{formatDateTime(c.checkedInAt, tz)} 📍</span>
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

function BigStat({ label, value, suffix, tone }: { label: string; value: number; suffix?: string; tone?: "safe" | "problem" }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-1">
        <span
          className="font-display tabular text-4xl leading-none font-black"
          style={tone ? { color: `var(--color-${tone})` } : undefined}
        >
          {value}
        </span>
        {suffix && <span className="text-sm font-semibold text-muted">{suffix}</span>}
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
