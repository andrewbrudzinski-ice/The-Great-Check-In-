"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Board } from "@/components/Board";
import { CheckInButton } from "@/components/CheckIn";
import { GearIcon } from "@/components/Icons";
import { InstallBanner } from "@/components/InstallApp";
import { WeekReveal } from "@/components/WeekReveal";
import { SectionTitle } from "@/components/ui";
import { useGame } from "@/lib/store";
import { line, playerLine } from "@/lib/trash";
import { DAY_SHORT, addDays, formatDuration, formatTime, isoWeekNumber, localDate, weekRangeLabel } from "@/lib/week";

const SEEN_KEY = "tgci-reveal-seen";

export default function Home() {
  const { data, game, me, now } = useGame();
  const s = data.settings;
  const tz = s.timezone;
  const mine = game.standings.find((r) => r.player.id === me?.id);
  const ctx = { weekStart: game.weekStart, dayIndex: game.dayIndex, daysLeft: game.daysLeft };

  // End-of-week reveal: shown once per finished week per device.
  const [revealOpen, setRevealOpen] = useState(false);
  const last = game.lastFinishedWeek;
  useEffect(() => {
    if (!last) return;
    try {
      if (localStorage.getItem(SEEN_KEY) !== last.weekStart) setRevealOpen(true);
    } catch {
      /* storage blocked: skip the auto reveal */
    }
  }, [last]);
  const closeReveal = () => {
    setRevealOpen(false);
    try {
      if (last) localStorage.setItem(SEEN_KEY, last.weekStart);
    } catch {
      /* ignore */
    }
  };
  const lastWeekStreaks = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(game.stats).map(([id, st]) => [id, st.currentStreak - (st.streakIncludesThisWeek ? 1 : 0)]),
      ),
    [game.stats],
  );

  // Today's check-ins, newest first
  const today = game.checkInsThisWeek
    .filter((c) => localDate(c.checkedInAt, tz) === game.today)
    .slice()
    .reverse();
  const playerById = (id: string) => data.players.find((p) => p.id === id);

  // dots per day for the week strip
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(game.weekStart, i);
    return game.checkInsThisWeek.filter((c) => localDate(c.checkedInAt, tz) === d);
  });

  return (
    <div>
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">
            Week {isoWeekNumber(game.weekStart)} <span className="text-line-strong">/</span> {weekRangeLabel(game.weekStart)}
          </p>
          <h1 className="font-display mt-2 text-[40px] leading-[0.9] font-black text-balance">{s.appTitle}</h1>
          <p className="mt-2 text-sm text-muted">{s.appSubtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
          <Link href="/settings" aria-label="Settings" className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-ink">
            <GearIcon size={20} />
          </Link>
          {me && (
            <Link href={`/profile?id=${me.id}`} aria-label="My profile">
              <Avatar player={me} size={36} ring />
            </Link>
          )}
        </div>
      </header>

      {game.owed.length > 0 && (
        <Link
          href="/punishments"
          className="mt-5 flex items-center gap-2 rounded-xl border border-problem/30 bg-problem/[0.08] px-3 py-2 text-[13px]"
        >
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-problem" />
          <span className="flex-1">
            <b className="text-problem">{game.owed.length}</b> group punishment{game.owed.length === 1 ? "" : "s"} still owed
          </span>
          <span className="text-xs text-muted">Settle up →</span>
        </Link>
      )}

      {/* Week strip */}
      <div className="mt-6 flex items-center gap-3">
        <div className="grid flex-1 grid-cols-7 gap-1">
          {DAY_SHORT.map((d, i) => {
            const isToday = i === game.dayIndex;
            const past = i < game.dayIndex;
            return (
              <div
                key={d}
                className={`flex flex-col items-center gap-1 rounded-lg py-1.5 ${isToday ? "bg-surface-2 ring-1 ring-line-strong" : ""}`}
              >
                <span className={`text-[10px] font-bold tracking-wider uppercase ${isToday ? "text-volt" : past ? "text-ink-2" : "text-muted/60"}`}>
                  {d.slice(0, 1)}
                </span>
                <span className="flex h-1.5 items-center gap-[2px]">
                  {perDay[i].length === 0 ? (
                    <span className={`h-1 w-1 rounded-full ${past ? "bg-surface-3" : "bg-transparent"}`} />
                  ) : (
                    perDay[i].slice(0, 4).map((c) => (
                      <span key={c.id} className="h-1.5 w-1.5 rounded-full" style={{ background: playerById(c.userId)?.color }} />
                    ))
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <div className="text-right">
          <p className="font-display tabular text-lg leading-none font-black">{formatDuration(game.weekEndsAt.getTime() - now.getTime())}</p>
          <p className="mt-1 text-[10px] font-semibold tracking-wider text-muted uppercase">left</p>
        </div>
      </div>

      {/* Board */}
      <section className="mt-6" aria-label="This week">
        {game.everyoneSafe && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-2 rounded-2xl bg-volt px-4 py-2.5 text-center font-display text-sm font-black tracking-[0.1em] text-volt-ink"
          >
            {line("everyoneSafe", game.weekStart)}
          </motion.div>
        )}
        <Board />
      </section>

      {/* The button */}
      <section className="mt-6" aria-label="Check in">
        {mine && (
          <p className="mb-3 flex items-baseline justify-between gap-3 px-1">
            <span className="text-[13px] text-ink-2">{playerLine(mine, ctx, true)}</span>
            <span className="eyebrow shrink-0">
              You <span className="tabular text-ink">{mine.count}/{mine.required}</span>
            </span>
          </p>
        )}
        <CheckInButton />
      </section>

      <InstallBanner />

      {/* Today */}
      <section className="mt-9">
        <SectionTitle>Today</SectionTitle>
        {today.length === 0 ? (
          <p className="py-2 text-sm text-muted">
            <span className="mr-2">🦗</span>
            {line("quiet", game.today)}
          </p>
        ) : (
          <ul className="space-y-1">
            {today.map((c) => {
              const p = playerById(c.userId);
              if (!p) return null;
              return (
                <motion.li key={c.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                  <Link href={`/map?checkin=${c.id}`} className="flex items-center gap-3 py-1.5" aria-label={`${p.name}'s check-in receipt`}>
                    <Avatar player={p} size={30} />
                    <span className="flex-1 text-sm">
                      <b className="font-semibold">{p.name}</b> <span className="text-muted">checked in at {c.gymName}</span>
                    </span>
                    <span className="tabular text-xs text-muted">{formatTime(c.checkedInAt, tz)}</span>
                    <span className="text-xs text-muted">📍</span>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Stakes */}
      <section className="mt-8">
        <SectionTitle>On the line</SectionTitle>
        <Link href="/punishments" className="group block">
          <p className="font-display text-xl leading-snug font-extrabold">“{s.punishment}”</p>
          <p className="mt-1.5 text-xs text-muted">
            If <b className="text-ink-2">anyone</b> finishes under {s.weeklyRequirement} by Sunday night, the whole group does it.
          </p>
          <p className="mt-3 flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm group-hover:border-line-strong">
            {game.owed.length === 0 ? (
              <span className="text-safe">✓ All square. Nothing owed.</span>
            ) : (
              <span>
                <b className="tabular text-problem">{game.owed.length}</b> punishment{game.owed.length === 1 ? "" : "s"} owed
              </span>
            )}
            <span className="text-xs text-muted group-hover:text-ink">Tracker →</span>
          </p>
        </Link>
      </section>

      {last && (
        <button onClick={() => setRevealOpen(true)} className="mt-8 w-full rounded-2xl border border-line py-3 text-xs font-semibold text-muted hover:text-ink">
          Replay last week&apos;s results
        </button>
      )}

      <WeekReveal week={last} open={revealOpen} onClose={closeReveal} streaks={lastWeekStreaks} />
    </div>
  );
}
