"use client";

import Link from "next/link";
import { LayoutGroup, motion } from "motion/react";
import { Avatar } from "@/components/Avatar";
import { SkullIcon } from "@/components/Icons";
import { PageTitle, SectionTitle, SegmentBar, StatusPill, StreakBadge } from "@/components/ui";
import { STATUS_META } from "@/lib/game";
import { useGame } from "@/lib/store";
import { joinNames, line, troubleLine } from "@/lib/trash";
import { formatDuration, weekRangeLabel } from "@/lib/week";

const MEDALS = ["🥇", "🥈", "🥉"];
const PLACES = ["1st", "2nd", "3rd"];

export default function StandingsPage() {
  const { data, game, now, me } = useGame();
  const s = data.settings;
  const ctx = { weekStart: game.weekStart, dayIndex: game.dayIndex, daysLeft: game.daysLeft };
  const short = game.standings.filter((p) => !p.completed && !p.warmup);

  const streakBoard = [...game.standings].sort(
    (a, b) => (game.stats[b.player.id]?.currentStreak ?? 0) - (game.stats[a.player.id]?.currentStreak ?? 0),
  );

  return (
    <div>
      <PageTitle eyebrow={`Week of ${weekRangeLabel(game.weekStart)}`} title="Standings" />

      {/* Leaderboard */}
      <SectionTitle>Check-ins this week</SectionTitle>
      <LayoutGroup>
        <ol className="space-y-1">
          {game.standings.map((pw, i) => (
            <motion.li
              layout
              key={pw.player.id}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className={`flex items-center gap-3 rounded-2xl px-2 py-3 ${i === 0 ? "bg-surface/70" : ""}`}
            >
              <span className="w-9 text-center text-2xl" aria-label={PLACES[i] ?? `${i + 1}th`}>
                {MEDALS[i] ?? <span className="font-display text-base font-black text-muted">{i + 1}</span>}
              </span>
              <Link href={`/profile?id=${pw.player.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar player={pw.player} size={44} ring={pw.player.id === me?.id} />
                <div className="min-w-0 flex-1">
                  <p className="font-display truncate text-lg font-extrabold">{pw.player.name}</p>
                  {pw.completed ? (
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="inline-flex items-center gap-1 rounded-md bg-safe/15 px-1.5 py-0.5 font-display text-[10px] font-black tracking-[0.12em] text-safe"
                    >
                      ✓ GOAL COMPLETE
                      {pw.count > pw.required && <span className="font-semibold text-safe/70">· +{pw.count - pw.required} BONUS</span>}
                    </motion.span>
                  ) : (
                    <span className="text-xs text-muted">{pw.remaining} to go</span>
                  )}
                </div>
              </Link>
              <span className="font-display tabular text-4xl font-black">{pw.count}</span>
            </motion.li>
          ))}
        </ol>
      </LayoutGroup>
      <p className="mt-2 px-2 text-[11px] text-muted">
        Hitting {s.weeklyRequirement} is what matters. Ties go to whoever got there first.
      </p>

      {/* Who's in trouble */}
      <section className="mt-10">
        <SectionTitle right={<span className="tabular text-[11px] text-muted">{formatDuration(game.weekEndsAt.getTime() - now.getTime())} left</span>}>
          Who&apos;s in trouble?
        </SectionTitle>
        {game.everyoneSafe ? (
          <div className="rounded-3xl bg-volt px-5 py-6 text-center text-volt-ink">
            <p className="font-display text-3xl font-black">EVERYONE IS SAFE.</p>
            <p className="mt-1 text-sm font-medium opacity-70">{line("everyoneSafe", game.weekStart + "x")}</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {[...game.standings]
              .sort((a, b) => b.remaining - a.remaining)
              .map((pw) => {
                const meta = STATUS_META[pw.status];
                return (
                  <li key={pw.player.id} className="flex gap-3">
                    <span className="mt-1 h-10 w-1 shrink-0 rounded-full" style={{ background: meta.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span aria-hidden>{meta.dot}</span>
                        <StatusPill status={pw.status} />
                        {pw.inDanger && <span className="text-[10px] font-black tracking-wider text-problem">← IN DANGER</span>}
                      </div>
                      <p className="mt-1.5 text-[15px] font-medium">{troubleLine(pw, ctx)}</p>
                      <div className="mt-2 max-w-[220px]">
                        <SegmentBar count={pw.count} required={pw.required} status={pw.status} height={5} />
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      {/* Punishment */}
      <section className="mt-10">
        <SectionTitle>Group punishment</SectionTitle>
        <Link
          href="/punishments"
          className="relative block overflow-hidden rounded-3xl border border-problem/25 bg-[linear-gradient(160deg,rgba(251,65,102,0.12),rgba(251,65,102,0.02)_55%)] px-5 py-6"
        >
          <SkullIcon size={90} strokeWidth={1.2} className="absolute -right-4 -bottom-4 text-problem/10" />
          <p className="font-display text-2xl leading-tight font-extrabold">“{s.punishment}”</p>
          <p className="mt-1.5 text-xs text-muted">One person misses, the whole group does it.</p>
          <p className="mt-4 text-sm text-ink-2">
            {short.length === 0 ? (
              <>Nobody&apos;s putting the group on the hook right now.</>
            ) : (
              <>
                If the week ended now, <b className="text-problem">{joinNames(short.map((p) => p.player.name))}</b> would sign everyone up.
              </>
            )}
          </p>
          <div className="relative mt-5 flex items-center justify-between border-t border-problem/15 pt-4">
            <span className="text-sm">
              {game.owed.length === 0 ? (
                <span className="text-safe">✓ All square</span>
              ) : (
                <>
                  <b className="font-display tabular text-xl text-problem">{game.owed.length}</b> owed
                </>
              )}
              <span className="text-muted"> · {game.paid.length} done</span>
            </span>
            <span className="text-xs font-semibold text-ink-2">Open tracker →</span>
          </div>
        </Link>
      </section>

      {/* Streaks */}
      <section className="mt-10">
        <SectionTitle>Streaks</SectionTitle>
        <ul className="grid grid-cols-3 gap-2">
          {streakBoard.map((pw) => {
            const st = game.stats[pw.player.id];
            return (
              <li key={pw.player.id}>
                <Link
                  href={`/profile?id=${pw.player.id}`}
                  className="flex flex-col items-center rounded-2xl border border-line bg-surface/50 px-2 py-4 text-center"
                >
                  <Avatar player={pw.player} size={40} />
                  <p className="mt-2 truncate text-xs font-semibold">{pw.player.name}</p>
                  <p className="font-display tabular mt-1 text-3xl font-black">{st.currentStreak}</p>
                  <p className="text-[10px] tracking-wider text-muted uppercase">
                    week{st.currentStreak === 1 ? "" : "s"} {st.currentStreak >= 6 ? "🔥🔥" : st.currentStreak > 0 ? "🔥" : ""}
                  </p>
                  <div className="mt-2">
                    <StreakBadge weeks={st.bestStreak} />
                  </div>
                  <p className="mt-0.5 text-[9px] text-muted uppercase">best</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
