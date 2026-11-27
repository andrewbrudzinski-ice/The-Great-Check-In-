"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Board } from "@/components/Board";
import { ChallengesHome } from "@/components/Challenges";
import { CheckInButton } from "@/components/CheckIn";
import { ChevronRight, ClockIcon, GearIcon, HistoryIcon } from "@/components/Icons";
import { InstallBanner } from "@/components/InstallApp";
import { Mark } from "@/components/Mark";
import { RollingNumber } from "@/components/RollingNumber";
import { WeekGrid } from "@/components/WeekGrid";
import { WeekReveal } from "@/components/WeekReveal";
import { SectionTitle } from "@/components/ui";
import type { GameState, PlayerWeek } from "@/lib/game";
import { useGame } from "@/lib/store";
import { line, playerLine } from "@/lib/trash";
import type { CheckIn } from "@/lib/types";
import { DAY_SHORT, dayIndex, formatDuration, formatTime, isoWeekNumber, localDate, weekRangeLabel } from "@/lib/week";

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
  const myWeek = me ? game.checkInsThisWeek.filter((c) => c.userId === me.id) : [];
  const playerById = (id: string) => data.players.find((p) => p.id === id);
  const inDanger = game.standings.filter((p) => p.inDanger).length;

  return (
    <div className="relative">
      {/* Faint lime grid and glow behind the top of the screen. Decoration only. */}
      <div aria-hidden className="grid-texture pointer-events-none absolute -inset-x-4 -top-[calc(var(--safe-top)+20px)] h-[560px]" />
      <div aria-hidden className="pointer-events-none absolute top-12 -left-36 h-[440px] w-[440px] rounded-full bg-[radial-gradient(closest-side,rgba(200,255,61,0.12),transparent)]" />

      <div className="relative">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 font-display text-[15px] font-extrabold tracking-[0.02em] uppercase">
              <Mark size={18} className="shrink-0" />
              <span className="truncate">{s.appTitle}</span>
            </h1>
            <p className="eyebrow mt-1 truncate">
              Week {isoWeekNumber(game.weekStart)} <span className="text-faint">/</span> {weekRangeLabel(game.weekStart)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link href="/settings" aria-label="Settings" className="grid h-10 w-10 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink">
              <GearIcon size={20} />
            </Link>
            {me && (
              <Link href={`/profile?id=${me.id}`} aria-label="My profile" className="pressable">
                <Avatar player={me} size={36} ring />
              </Link>
            )}
          </div>
        </header>
        {s.appSubtitle && <p className="mt-1.5 truncate text-[12.5px] text-muted">{s.appSubtitle}</p>}

        {game.owed.length > 0 && (
          <Link
            href="/punishments"
            className="pressable mt-5 flex min-h-11 items-center gap-2.5 rounded-xl py-2 bg-problem/[0.07] px-3.5 text-[13px] shadow-[inset_0_0_0_1px_rgb(255_77_106/0.2)]"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-problem shadow-[0_0_0_4px_rgb(255_77_106/0.15)]" />
            <span className="flex-1">
              <b className="font-semibold text-problem">{game.owed.length}</b> group punishment{game.owed.length === 1 ? "" : "s"} still owed
            </span>
            <span className="font-mono text-[10.5px] tracking-[0.06em] text-muted uppercase">Settle up →</span>
          </Link>
        )}

        {/* Phones: one column. Widest screens: you and the race on the left, the rest beside it. */}
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] xl:items-start xl:gap-x-14">
          <div>
            {/* Your week */}
            {mine && <YourWeek pw={mine} game={game} now={now} tz={tz} myWeek={myWeek} text={mine.paused ? "You're paused. Check in if you like; it won't count against you." : playerLine(mine, ctx, true, game.standings.filter((pw) => !pw.paused))} />}

            {/* The button */}
            <section className="mt-6" aria-label="Check in">
              <CheckInButton />
            </section>

            {/* The race */}
            <section className="mt-11" aria-label="This week">
              <SectionTitle
                index="01"
                right={<span className="eyebrow">{inDanger ? `${inDanger} in danger` : "Nobody in danger"}</span>}
              >
                The race
              </SectionTitle>
              {game.everyoneSafe && (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-2 rounded-2xl bg-volt px-4 py-2.5 text-center font-display text-sm font-black tracking-[0.08em] text-volt-ink uppercase"
                >
                  {line("everyoneSafe", game.weekStart)}
                </motion.div>
              )}
              <Board />
            </section>
          </div>

          <div>
            {/* Who went when */}
            <section className="mt-10 xl:mt-7" aria-label="Who went when">
              <SectionTitle index="02">Who went when</SectionTitle>
              <WeekGrid />
            </section>

            {/* Daily challenges */}
            <section className="mt-11" aria-label="Daily challenges">
              <SectionTitle index="03">Daily challenge</SectionTitle>
              <ChallengesHome />
            </section>

            <InstallBanner />

            {/* Today */}
            <section className="mt-11" aria-label="Today">
              <SectionTitle
                index="04"
                right={
                  <Link href="/map" className="font-mono text-[10.5px] tracking-[0.06em] text-muted uppercase hover:text-ink">
                    Map →
                  </Link>
                }
              >
                Today
              </SectionTitle>
              {today.length === 0 ? (
                <div className="flex items-center gap-4 rounded-2xl bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.025)_0_1px,transparent_1px_8px)] px-4 py-4 shadow-[inset_0_0_0_1px_var(--color-line)]">
                  <span className="font-big text-[44px] leading-none text-surface-3" aria-hidden>
                    0
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold">{line("quiet", game.today)}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">First one in takes the top of the feed.</p>
                  </div>
                </div>
              ) : (
                <ul>
                  {today.map((c) => {
                    const p = playerById(c.userId);
                    if (!p) return null;
                    return (
                      <motion.li key={c.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                        <Link
                          href={`/map?checkin=${c.id}`}
                          className="flex items-center gap-3 border-b border-line py-2.5 transition-colors last:border-b-0 active:bg-white/[0.02]"
                          aria-label={`${p.name}'s check-in receipt`}
                        >
                          <span className="w-[58px] shrink-0 font-mono text-[11px] text-muted tabular">{formatTime(c.checkedInAt, tz)}</span>
                          <Avatar player={p} size={28} />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            <b className="font-semibold">{p.name}</b> <span className="text-muted">at {c.gymName}</span>
                          </span>
                          {c.manual && <span className="font-mono text-[9.5px] tracking-[0.06em] text-muted uppercase">Manual</span>}
                          <ChevronRight size={15} className="text-faint" />
                        </Link>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Stakes */}
            <section className="mt-11" aria-label="On the line">
              <SectionTitle index="05">On the line</SectionTitle>
              <Link href="/punishments" className="pressable relative block rounded-[22px] bg-surface shadow-[inset_0_0_0_1px_var(--color-line)]">
                <div className="px-5 pt-5 pb-4">
                  <p className="eyebrow">If anyone misses by Sunday</p>
                  <p className="font-big mt-2.5 text-[34px] leading-[0.98]">
                    <span className="text-volt">“</span>
                    {s.punishment}
                    <span className="text-volt">”</span>
                  </p>
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
                    If <b className="text-ink-2">anyone</b> misses their weekly goal by Sunday night, the whole group does it.
                  </p>
                </div>
                <div aria-hidden className="mx-3.5 h-px bg-[linear-gradient(90deg,rgb(255_255_255/0.2)_50%,transparent_50%)] bg-[length:8px_1px]" />
                <span aria-hidden className="absolute bottom-[47px] -left-[9px] h-[18px] w-[18px] rounded-full bg-bg" />
                <span aria-hidden className="absolute -right-[9px] bottom-[47px] h-[18px] w-[18px] rounded-full bg-bg" />
                <div className="flex h-14 items-center justify-between px-5">
                  {game.owed.length === 0 ? (
                    <span className="text-sm text-volt">✓ All square. Nothing owed.</span>
                  ) : (
                    <span className="flex items-baseline gap-2 text-sm">
                      <b className="font-big text-[28px] leading-none text-problem">{game.owed.length}</b> punishment{game.owed.length === 1 ? "" : "s"} owed
                    </span>
                  )}
                  <span className="font-mono text-[10.5px] tracking-[0.06em] text-muted uppercase">Tracker →</span>
                </div>
              </Link>
            </section>

            {last && (
              <button
                onClick={() => setRevealOpen(true)}
                className="mx-auto mt-6 flex items-center gap-2 px-3 py-2.5 text-[12.5px] font-medium text-muted transition-colors hover:text-ink"
              >
                <HistoryIcon size={15} />
                Replay last week&apos;s results
              </button>
            )}
          </div>
        </div>
      </div>

      <WeekReveal week={last} open={revealOpen} onClose={closeReveal} streaks={lastWeekStreaks} />
    </div>
  );
}

/** The top of Home: your count, huge, with the countdown and the days you went. */
function YourWeek({ pw, game, now, tz, myWeek, text }: { pw: PlayerWeek; game: GameState; now: Date; tz: string; myWeek: CheckIn[]; text: string }) {
  const segments = Math.min(Math.max(pw.required, 1), 14);
  const showDays = segments <= 7;
  const extra = pw.count - pw.required;
  const endsLabel = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: tz }).format(
    new Date(game.weekEndsAt.getTime() - 60000),
  );
  const daysLeft = game.daysLeft;
  return (
    <section aria-label="Your week" className="mt-7">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow !text-volt">Your week</span>
        <span className="eyebrow">
          {pw.paused ? "Paused" : pw.warmup ? "Warm-up week" : `${DAY_SHORT[game.dayIndex]} · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="flex items-end" aria-hidden>
          <span className="font-big text-[clamp(128px,44vw,184px)] leading-[0.82]">
            <RollingNumber value={pw.count} />
          </span>
          <span className="font-big pb-1.5 text-[clamp(42px,15vw,62px)] leading-[0.9] text-faint">/{pw.required}</span>
        </p>
        <span className="sr-only">
          You: {pw.count} of {pw.required} this week
        </span>
        <div className="flex flex-col items-end gap-1.5 pb-2 text-right">
          <span className="font-big text-[clamp(30px,11vw,44px)] leading-[0.9]">{formatDuration(game.weekEndsAt.getTime() - now.getTime())}</span>
          <span className="eyebrow flex items-center gap-1">
            <ClockIcon size={11} />
            until {endsLabel}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-[5px]" style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))` }} aria-hidden>
        {Array.from({ length: segments }, (_, i) => (
          <span key={i} className="relative h-3 overflow-hidden rounded-[3px] shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.14)]">
            <span
              className="absolute inset-y-0 left-0 rounded-[3px] bg-volt shadow-[0_0_18px_-4px_rgb(200_255_61/0.55)] transition-[width] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              style={{ width: i < pw.count ? "100%" : "0%", transitionDelay: "120ms" }}
            />
          </span>
        ))}
      </div>
      {showDays && (
        <div className="mt-2 grid gap-[5px]" style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))` }} aria-hidden>
          {Array.from({ length: segments }, (_, i) => {
            const c = myWeek[i];
            const label = c ? DAY_SHORT[dayIndex(localDate(c.checkedInAt, tz))] : i === segments - 1 ? "Goal" : "";
            return (
              <span key={i} className={`font-mono text-[10px] tracking-[0.06em] uppercase ${c ? "text-muted" : "text-ink"}`}>
                {label}
              </span>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[18px] leading-snug font-medium tracking-[-0.01em] text-balance">
        {text}
        {extra > 0 && <span className="ml-2 align-middle font-mono text-[10.5px] tracking-[0.06em] text-volt uppercase">+{extra} extra</span>}
      </p>
    </section>
  );
}
