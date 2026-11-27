"use client";

import Link from "next/link";
import { LayoutGroup, motion } from "motion/react";
import type { PlayerWeek } from "@/lib/game";
import { useGame } from "@/lib/store";
import { playerLines } from "@/lib/trash";
import { Avatar } from "./Avatar";
import { RollingNumber } from "./RollingNumber";
import { StreakBadge, WeekTag } from "./ui";

/**
 * The board on Home, drawn as a race: everyone's avatar sits on a track and
 * moves toward the finish post at their weekly goal. Real danger (no slack
 * left) gets a hatched red track and the reason spelled out.
 */
export function Board() {
  const { game, me } = useGame();
  const ctx = { weekStart: game.weekStart, dayIndex: game.dayIndex, daysLeft: game.daysLeft };
  // Everyone gets a different line.
  const lines = playerLines(
    game.standings.filter((pw) => !pw.paused),
    ctx,
  );
  return (
    <LayoutGroup>
      <ol>
        {game.standings.map((pw) => (
          <Lane
            key={pw.player.id}
            pw={pw}
            isMe={pw.player.id === me?.id}
            streak={game.stats[pw.player.id]?.currentStreak ?? 0}
            text={pw.paused ? "On pause. This week doesn't count." : (lines.get(pw.player.id) ?? "")}
            daysLeft={game.daysLeft}
          />
        ))}
      </ol>
    </LayoutGroup>
  );
}

function Lane({ pw, isMe, streak, text, daysLeft }: { pw: PlayerWeek; isMe: boolean; streak: number; text: string; daysLeft: number }) {
  const danger = pw.inDanger;
  const leader = pw.rank === 1 && pw.count > 0 && !pw.paused;
  const frac = Math.min(1, pw.required ? pw.count / pw.required : 0);
  const openDays = Math.max(0, daysLeft - (pw.checkedInToday ? 1 : 0));
  // One gate per check-in on the way to the goal (skipped for very high goals).
  const gates = pw.required > 1 && pw.required <= 12 ? Array.from({ length: pw.required - 1 }, (_, i) => (i + 1) / pw.required) : [];

  return (
    <motion.li
      layout="position"
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className={`border-b border-line last:border-b-0 ${pw.paused ? "opacity-55" : ""}`}
    >
      <Link href={`/profile?id=${pw.player.id}`} className="group block py-4 transition-colors active:bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <span className={`font-big w-6 shrink-0 text-[32px] leading-[0.85] ${leader ? "text-volt" : "text-faint"}`}>{pw.rank}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-display text-[18px] font-extrabold">{pw.player.name}</span>
              {isMe && <span className="shrink-0 rounded-[4px] bg-volt px-1.5 py-px font-mono text-[9px] font-medium tracking-[0.06em] text-volt-ink">YOU</span>}
              {streak > 0 && <StreakBadge weeks={streak} />}
            </div>
            <p className="truncate text-[12.5px] text-muted">{text}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="font-big flex items-end text-[34px] leading-[0.85]">
              <RollingNumber value={pw.count} />
              <span className="text-[18px] text-faint">/{pw.required}</span>
            </span>
            <WeekTag pw={pw} />
          </div>
        </div>

        <div className={`relative mt-3 ml-9 h-[34px] rounded-full ${danger ? "risk-hatch" : ""}`} aria-hidden>
          <span className="absolute inset-x-0 top-[16px] h-[2px] rounded-full bg-white/10" />
          <span
            className="absolute top-[15px] left-0 h-1 rounded-full bg-volt transition-[width] duration-700 ease-[cubic-bezier(0.25,0.9,0.25,1)]"
            style={{
              width: pw.count === 0 ? 0 : `calc((100% - 32px) * ${frac} + 16px)`,
              boxShadow: leader ? "0 0 14px -2px rgb(200 255 61 / 0.55)" : undefined,
            }}
          />
          {gates.map((g) => (
            <span key={g} className="absolute top-[11px] h-3 w-px bg-white/20" style={{ left: `calc((100% - 32px) * ${g} + 16px)` }} />
          ))}
          <span className="absolute top-[2px] right-[15px] h-[30px] w-[3px] rounded-[1px] bg-ink" />
          <span
            className="absolute top-px transition-[left] duration-700 ease-[cubic-bezier(0.25,0.9,0.25,1)]"
            style={{ left: `calc((100% - 32px) * ${frac})` }}
          >
            <Avatar player={pw.player} size={32} ring={isMe} />
          </span>
        </div>
        {danger && (
          <p className="mt-1.5 text-right font-mono text-[10px] tracking-[0.06em] text-problem uppercase">
            Needs {pw.remaining} in {openDays} day{openDays === 1 ? "" : "s"}
            {pw.needsDoubles && " · doubles"}
          </p>
        )}
      </Link>
    </motion.li>
  );
}
