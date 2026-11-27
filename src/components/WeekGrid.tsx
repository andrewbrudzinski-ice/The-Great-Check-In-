"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useGame } from "@/lib/store";
import { DAY_LONG, DAY_SHORT, addDays, formatTime, localDate } from "@/lib/week";
import { Avatar } from "./Avatar";
import { ChevronRight } from "./Icons";

/**
 * Who went when: one row per player, one column per day of this week.
 * Each day is a button; tapping it opens that day's check-ins (who, when,
 * where), each linking to its receipt on the map.
 */
export function WeekGrid() {
  const { data, game } = useGame();
  const tz = data.settings.timezone;
  const [open, setOpen] = useState<number | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(game.weekStart, i));
  const byDay = days.map((d) => game.checkInsThisWeek.filter((c) => localDate(c.checkedInAt, tz) === d));
  const rows = game.standings;
  const playerById = (id: string) => data.players.find((p) => p.id === id);

  const pick = (i: number) => setOpen((o) => (o === i ? null : i));
  const selected = open == null ? null : byDay[open];

  return (
    <div>
      <div className="flex gap-2">
        {/* Names */}
        <div className="flex w-[92px] shrink-0 flex-col">
          <span className="h-7" />
          {rows.map((pw) => (
            <span key={pw.player.id} className={`flex h-[34px] items-center gap-2 text-[13.5px] font-semibold ${pw.paused ? "opacity-50" : ""}`}>
              <Avatar player={pw.player} size={20} />
              <span className="truncate">{pw.player.name}</span>
            </span>
          ))}
        </div>

        {/* One button per day */}
        <div className="grid flex-1 grid-cols-7 gap-1">
          {days.map((d, i) => {
            const today = i === game.dayIndex;
            const future = i > game.dayIndex;
            const isOpen = open === i;
            return (
              <button
                key={d}
                type="button"
                onClick={() => pick(i)}
                aria-expanded={isOpen}
                aria-label={`${DAY_LONG[i]}: ${byDay[i].length} check-in${byDay[i].length === 1 ? "" : "s"}`}
                className={`flex flex-col items-stretch rounded-[10px] px-[3px] pb-1 transition-colors ${isOpen ? "bg-white/[0.06]" : "active:bg-white/[0.04]"}`}
              >
                <span
                  className={`flex h-7 items-center justify-center font-mono text-[10.5px] font-medium ${
                    today ? "text-volt" : future ? "text-faint" : "text-muted"
                  }`}
                >
                  {DAY_SHORT[i].slice(0, 1)}
                </span>
                {rows.map((pw) => {
                  const n = byDay[i].filter((c) => c.userId === pw.player.id).length;
                  return (
                    <span key={pw.player.id} className={`flex h-[34px] items-center justify-center ${pw.paused ? "opacity-50" : ""}`}>
                      {n > 0 ? (
                        <motion.span
                          initial={false}
                          animate={{ scale: 1 }}
                          className="grid aspect-square w-full max-w-[30px] place-items-center rounded-[7px] bg-volt font-mono text-[10px] font-medium text-volt-ink"
                        >
                          {n > 1 ? `×${n}` : ""}
                        </motion.span>
                      ) : future ? (
                        <span className="h-1 w-1 rounded-full bg-surface-3" />
                      ) : (
                        <span className={`aspect-square w-full max-w-[30px] rounded-[7px] ${today ? "ring-[1.5px] ring-volt/70 ring-inset" : "bg-surface-2"}`} />
                      )}
                    </span>
                  );
                })}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {selected && open != null && (
          <motion.div
            key="day"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl bg-surface p-1.5 shadow-[inset_0_0_0_1px_var(--color-line)]">
              <p className="eyebrow px-2.5 pt-2 pb-1.5">{DAY_LONG[open]}</p>
              {selected.length === 0 ? (
                <p className="px-2.5 pb-2.5 text-sm text-muted">{open > game.dayIndex ? "Hasn't happened yet." : `Nobody went on ${DAY_LONG[open]}.`}</p>
              ) : (
                <ul>
                  {selected.map((c) => {
                    const p = playerById(c.userId);
                    if (!p) return null;
                    return (
                      <li key={c.id}>
                        <Link href={`/map?checkin=${c.id}`} className="flex items-center gap-3 rounded-xl px-2.5 py-2 active:bg-white/[0.04]">
                          <Avatar player={p} size={26} />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            <b className="font-semibold">{p.name}</b> <span className="text-muted">at {c.gymName}</span>
                          </span>
                          {c.manual && <span className="font-mono text-[9.5px] tracking-[0.06em] text-muted uppercase">Manual</span>}
                          <span className="font-mono text-[11px] text-muted tabular">{formatTime(c.checkedInAt, tz)}</span>
                          <ChevronRight size={14} className="text-faint" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
