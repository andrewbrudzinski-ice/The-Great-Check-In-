"use client";

import Link from "next/link";
import { LayoutGroup, motion } from "motion/react";
import { useMemo } from "react";
import { Avatar } from "@/components/Avatar";
import { ChevronRight, FlameIcon } from "@/components/Icons";
import { RollingNumber } from "@/components/RollingNumber";
import { SectionTitle, WeekTag } from "@/components/ui";
import type { PlayerWeek } from "@/lib/game";
import { firstToGoal } from "@/lib/season";
import { useGame } from "@/lib/store";
import { joinNames, line, troubleLines } from "@/lib/trash";
import { formatDuration, weekRangeLabel } from "@/lib/week";

export default function StandingsPage() {
  const { data, game, now, me } = useGame();
  const s = data.settings;
  const ctx = { weekStart: game.weekStart, dayIndex: game.dayIndex, daysLeft: game.daysLeft };
  const trouble = [...game.standings].filter((pw) => !pw.paused).sort((a, b) => b.remaining - a.remaining);
  const troubleText = troubleLines(trouble, ctx);
  const short = game.standings.filter((p) => !p.completed && !p.warmup && !p.paused);
  const season = useMemo(() => firstToGoal(game.history, data.checkIns, s.timezone), [game.history, data.checkIns, s.timezone]);
  const seasonRows = [...game.standings].sort(
    (a, b) =>
      (season.wins[b.player.id] ?? 0) - (season.wins[a.player.id] ?? 0) ||
      (game.stats[b.player.id]?.currentStreak ?? 0) - (game.stats[a.player.id]?.currentStreak ?? 0),
  );
  const firstWeek = game.history[game.history.length - 1]?.weekStart;
  const goals = new Set(game.standings.map((p) => p.required));
  const goalLabel = goals.size === 1 ? `Goal ${[...goals][0]}` : "Goal";

  return (
    <div className="relative">
      <div aria-hidden className="grid-texture pointer-events-none absolute -inset-x-4 -top-[calc(var(--safe-top)+20px)] h-[520px]" />
      <div className="relative">
        <header className="mb-9">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">
              Week of {weekRangeLabel(game.weekStart)} · {formatDuration(game.weekEndsAt.getTime() - now.getTime())} left
            </p>
            <Link
              href="/history"
              className="pressable flex h-9 shrink-0 items-center gap-1 rounded-full bg-surface-2 pr-2.5 pl-3.5 text-[12.5px] font-medium shadow-[inset_0_0_0_1px_var(--color-line)]"
            >
              History <ChevronRight size={14} />
            </Link>
          </div>
          <h1 className="font-big mt-3 text-[clamp(56px,20vw,80px)] leading-[0.82]">Standings</h1>
        </header>

        {/* Race to the goal */}
        <section aria-label="Check-ins this week">
          <SectionTitle index="01">Race to the goal</SectionTitle>
          <Podium standings={game.standings} meId={me?.id} goalLabel={goalLabel} />
          <p className="mt-3 text-center text-[12.5px] text-muted">Hitting your weekly goal is what matters. Ties go to whoever got there first.</p>
        </section>

        {/* Who's in trouble */}
        <section className="mt-11" aria-label="Who's in trouble">
          <SectionTitle index="02">Who&apos;s in trouble?</SectionTitle>
          {game.everyoneSafe ? (
            <div className="rounded-3xl bg-volt px-5 py-6 text-center text-volt-ink">
              <p className="font-big text-[40px] leading-none uppercase">Everyone is safe.</p>
              <p className="mt-2 text-sm font-medium opacity-70">{line("everyoneSafe", game.weekStart + "x")}</p>
            </div>
          ) : (
            <ul>
              {trouble.map((pw) => (
                <TroubleRow key={pw.player.id} pw={pw} text={troubleText.get(pw.player.id) ?? ""} daysLeft={game.daysLeft} />
              ))}
            </ul>
          )}
        </section>

        {/* Punishment */}
        <section className="mt-11" aria-label="Group punishment">
          <SectionTitle index="03">Group punishment</SectionTitle>
          <Link href="/punishments" className="pressable relative block rounded-[22px] bg-surface shadow-[inset_0_0_0_1px_var(--color-line)]">
            <div className="px-5 pt-5 pb-4">
              <p className="eyebrow">One misses, everyone pays</p>
              <p className="font-big mt-2.5 text-[34px] leading-[0.98]">
                <span className="text-volt">“</span>
                {s.punishment}
                <span className="text-volt">”</span>
              </p>
              <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
                {short.length === 0 ? (
                  <>Nobody&apos;s putting the group on the hook right now.</>
                ) : (
                  <>
                    If the week ended now, <b className="text-problem">{joinNames(short.map((p) => p.player.name))}</b> would sign everyone up.
                  </>
                )}
              </p>
            </div>
            <div aria-hidden className="mx-3.5 h-px bg-[linear-gradient(90deg,rgb(255_255_255/0.2)_50%,transparent_50%)] bg-[length:8px_1px]" />
            <span aria-hidden className="absolute bottom-[63px] -left-[9px] h-[18px] w-[18px] rounded-full bg-bg" />
            <span aria-hidden className="absolute -right-[9px] bottom-[63px] h-[18px] w-[18px] rounded-full bg-bg" />
            <div className="flex h-[72px] items-center gap-7 px-5">
              <span className="flex flex-col">
                <span className={`font-big text-[32px] leading-[0.9] ${game.owed.length ? "text-problem" : "text-volt"}`}>{game.owed.length}</span>
                <span className="eyebrow mt-1">Owed</span>
              </span>
              <span className="flex flex-col">
                <span className="font-big text-[32px] leading-[0.9]">{game.paid.length}</span>
                <span className="eyebrow mt-1">Done</span>
              </span>
              <span className="ml-auto font-mono text-[10.5px] tracking-[0.06em] text-muted uppercase">Tracker →</span>
            </div>
          </Link>
        </section>

        {/* Season */}
        <section className="mt-11" aria-label="Season">
          <SectionTitle index="04" right={firstWeek ? <span className="eyebrow">Since {weekRangeLabel(firstWeek).split(" – ")[0]}</span> : undefined}>
            Season
          </SectionTitle>
          <div className="grid grid-cols-[minmax(0,1fr)_64px_64px_44px] gap-x-2 border-b border-line-strong pb-2">
            <span />
            <span className="eyebrow text-right">First in</span>
            <span className="eyebrow text-right">Streak</span>
            <span className="eyebrow text-right">Best</span>
          </div>
          <ul>
            {seasonRows.map((pw, i) => {
              const st = game.stats[pw.player.id];
              const wins = season.wins[pw.player.id] ?? 0;
              return (
                <li key={pw.player.id}>
                  <Link
                    href={`/profile?id=${pw.player.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_64px_64px_44px] items-center gap-x-2 border-b border-line py-3 transition-colors last:border-b-0 active:bg-white/[0.02]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar player={pw.player} size={28} ring={pw.player.id === me?.id} />
                      <span className="truncate font-display text-[16px] font-extrabold">{pw.player.name}</span>
                    </span>
                    <span className={`font-big text-right text-[36px] leading-[0.85] ${i === 0 && wins > 0 ? "text-volt" : wins ? "" : "text-faint"}`}>{wins}</span>
                    <span className={`font-big flex items-center justify-end gap-1 text-[36px] leading-[0.85] ${st.currentStreak ? "" : "text-faint"}`}>
                      {st.currentStreak > 0 && <FlameIcon size={14} strokeWidth={2.2} className="text-ember" />}
                      {st.currentStreak}
                    </span>
                    <span className="font-big text-right text-[24px] leading-[0.85] text-faint">{st.bestStreak}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[12px] text-muted">
            <b className="font-semibold text-ink-2">First in</b>: weeks someone hit their goal before anyone else. Streak: weeks in a row hitting the goal.
          </p>
        </section>
      </div>
    </div>
  );
}

/** This week as bars climbing toward the goal line. */
function Podium({ standings, meId, goalLabel }: { standings: PlayerWeek[]; meId?: string; goalLabel: string }) {
  const H = 168;
  return (
    <LayoutGroup>
      <div className="relative mt-5">
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgb(244_245_246/0.5)_50%,transparent_50%)] bg-[length:8px_1px]" />
        <span className="eyebrow absolute -top-5 right-0 !text-ink">{goalLabel}</span>
        <ol className="flex items-end gap-3 px-1" style={{ height: H + 56 }}>
          {standings.map((pw) => {
            const frac = Math.min(1, pw.required ? pw.count / pw.required : 0);
            const leader = pw.rank === 1 && pw.count > 0 && !pw.paused;
            return (
              <motion.li
                key={pw.player.id}
                layout="position"
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                className={`flex min-w-0 flex-1 flex-col items-center gap-2 ${pw.paused ? "opacity-50" : ""}`}
              >
                <span className={`font-big text-[clamp(34px,11vw,52px)] leading-[0.85] ${pw.count ? "" : "text-faint"}`}>
                  <RollingNumber value={pw.count} />
                </span>
                <span
                  aria-hidden
                  className={`w-full max-w-[96px] rounded-t-[14px] transition-[height] duration-700 ease-[cubic-bezier(0.25,0.9,0.25,1)] ${
                    pw.inDanger ? "risk-hatch bg-volt/20 shadow-[inset_0_0_0_1px_rgb(200_255_61/0.35)]" : leader ? "bg-[linear-gradient(180deg,#d8ff6e,var(--color-volt))] shadow-[0_0_40px_-10px_rgb(200_255_61/0.55)]" : "bg-volt/80"
                  }`}
                  style={{ height: Math.max(6, frac * H) }}
                />
              </motion.li>
            );
          })}
        </ol>
        <span aria-hidden className="block h-px bg-line-strong" />
        <ol className="mt-3 flex gap-3 px-1">
          {standings.map((pw) => (
            <li key={pw.player.id} className="min-w-0 flex-1">
              <Link href={`/profile?id=${pw.player.id}`} className="flex flex-col items-center gap-1.5 text-center">
                <Avatar player={pw.player} size={40} ring={pw.player.id === meId} />
                <span className="w-full truncate font-display text-[15px] font-extrabold">{pw.player.name}</span>
                <WeekTag pw={pw} />
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </LayoutGroup>
  );
}

function TroubleRow({ pw, text, daysLeft }: { pw: PlayerWeek; text: string; daysLeft: number }) {
  const openDays = Math.max(0, daysLeft - (pw.checkedInToday ? 1 : 0));
  const done = pw.completed;
  return (
    <li className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3.5 border-b border-line py-4 last:border-b-0">
      <div>
        {done ? (
          <span className="font-big text-[44px] leading-[0.85] text-volt">✓</span>
        ) : (
          <span className={`font-big text-[44px] leading-[0.85] ${pw.inDanger ? "text-problem" : pw.remaining === 1 ? "text-volt" : ""}`}>
            {pw.remaining}
            <span className="text-[22px] text-muted"> in {openDays}</span>
          </span>
        )}
        <p className="eyebrow mt-1 !text-[9.5px]">{done ? "Goal hit" : "Needs · days"}</p>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-[17px] font-extrabold">{pw.player.name}</span>
          {pw.inDanger ? (
            <>
              <span className="shrink-0 rounded-[4px] bg-problem px-1.5 py-[2px] font-mono text-[9.5px] tracking-[0.06em] text-white uppercase">In danger</span>
              {pw.needsDoubles && <span className="font-mono text-[9.5px] tracking-[0.06em] text-problem uppercase">Doubles</span>}
            </>
          ) : (
            !done && pw.remaining === 1 && <span className="font-mono text-[9.5px] tracking-[0.06em] text-volt uppercase">1 more</span>
          )}
        </div>
        <p className="mt-1 text-[14px] leading-snug text-ink-2">{text}</p>
      </div>
    </li>
  );
}
