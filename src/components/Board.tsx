"use client";

import Link from "next/link";
import { LayoutGroup, motion } from "motion/react";
import type { PlayerWeek } from "@/lib/game";
import { useGame } from "@/lib/store";
import { playerLine } from "@/lib/trash";
import { Avatar } from "./Avatar";
import { SegmentBar, StatusPill, StreakBadge } from "./ui";

/** The three-player board on Home. Danger is impossible to miss. */
export function Board() {
  const { game, me } = useGame();
  const ctx = { weekStart: game.weekStart, dayIndex: game.dayIndex, daysLeft: game.daysLeft };
  return (
    <LayoutGroup>
      <ol className="space-y-2">
        {game.standings.map((pw) => (
          <BoardRow
            key={pw.player.id}
            pw={pw}
            isMe={pw.player.id === me?.id}
            streak={game.stats[pw.player.id]?.currentStreak ?? 0}
            text={playerLine(pw, ctx)}
          />
        ))}
      </ol>
    </LayoutGroup>
  );
}

function BoardRow({ pw, isMe, streak, text }: { pw: PlayerWeek; isMe: boolean; streak: number; text: string }) {
  const danger = pw.inDanger;
  return (
    <motion.li
      layout
      transition={{ type: "spring", stiffness: 400, damping: 34 }}
      className={`relative overflow-hidden rounded-2xl border px-3.5 pt-3 pb-3.5 ${
        danger
          ? "border-problem/35 bg-[linear-gradient(100deg,rgba(251,65,102,0.13),rgba(251,65,102,0.02)_60%)]"
          : pw.completed
            ? "border-safe/20 bg-safe/[0.04]"
            : "border-line bg-surface/60"
      }`}
    >
      {danger && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] animate-pulse bg-problem" />}
      <Link href={`/profile?id=${pw.player.id}`} className="flex items-center gap-3">
        <span className="font-display tabular w-3 text-center text-sm font-black text-muted">{pw.rank}</span>
        <Avatar player={pw.player} size={42} ring={isMe} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-[17px] font-extrabold">{pw.player.name}</span>
            {isMe && <span className="rounded bg-volt/15 px-1 text-[9px] font-black tracking-wider text-volt">YOU</span>}
            {streak > 0 && <StreakBadge weeks={streak} />}
          </div>
          <p className={`truncate text-[12.5px] ${danger ? "text-problem/90" : "text-muted"}`}>{text}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-display tabular text-[28px] leading-none font-black">
            {pw.count}
            <span className="text-base text-muted">/{pw.required}</span>
          </span>
          {pw.warmup ? (
            <span className="rounded-full bg-surface-3 px-2 py-[3px] font-display text-[10px] font-bold tracking-[0.1em] text-muted" title="Joined mid-week — this week doesn't count">
              WARM-UP
            </span>
          ) : danger ? (
            <span className="rounded-full bg-problem px-2 py-[3px] font-display text-[10px] font-black tracking-[0.12em] text-white">
              DANGER
            </span>
          ) : (
            <StatusPill status={pw.status} label={pw.completed ? "SAFE ✓" : pw.remaining === 1 ? "1 MORE" : `${pw.remaining} TO GO`} />
          )}
        </div>
      </Link>
      <div className="mt-2.5 pl-6">
        <SegmentBar count={pw.count} required={pw.required} status={pw.status} />
      </div>
    </motion.li>
  );
}
