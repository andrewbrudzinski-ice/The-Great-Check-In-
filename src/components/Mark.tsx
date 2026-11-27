"use client";

import { motion } from "motion/react";

/**
 * The club's mark: the crosshair from the Check In button. No number in it,
 * since every club (and every player) can have a different weekly goal.
 * The same drawing is the app icon (public/icon.svg).
 */
const TICKS = ["M50 13v13", "M74 50h13", "M50 74v13", "M13 50h13"];
const LIME = "var(--color-volt)";

export function Mark({ size = 24, draw = false, className }: { size?: number; draw?: boolean; className?: string }) {
  if (!draw) {
    return (
      <svg width={size} height={size} viewBox="12 12 76 76" aria-hidden className={className}>
        <circle cx="50" cy="50" r="22" fill="none" stroke={LIME} strokeWidth={9} />
        <path d={TICKS.join("")} stroke={LIME} strokeWidth={9} />
        <circle cx="50" cy="50" r="8" fill={LIME} />
      </svg>
    );
  }
  // Drawn in: the ring traces round from the top, the ticks snap on, then the dot lands.
  return (
    <svg width={size} height={size} viewBox="12 12 76 76" aria-hidden className={className}>
      <motion.circle
        cx="50"
        cy="50"
        r="22"
        fill="none"
        stroke={LIME}
        strokeWidth={9}
        transform="rotate(-90 50 50)"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      />
      {TICKS.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          stroke={LIME}
          strokeWidth={9}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.45 + i * 0.06, duration: 0.2, ease: "easeOut" }}
        />
      ))}
      <motion.circle
        cx="50"
        cy="50"
        r="8"
        fill={LIME}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        style={{ transformOrigin: "50px 50px" }}
        transition={{ delay: 0.75, type: "spring", stiffness: 420, damping: 16 }}
      />
    </svg>
  );
}
