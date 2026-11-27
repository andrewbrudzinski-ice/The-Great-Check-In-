"use client";

import { motion } from "motion/react";

/**
 * The club's mark: a target ringed by five ticks, one per check-in of the
 * week. Four lit, one to go. The same drawing is the app icon (public/icon.svg).
 */
const ARCS = [
  "M53.76 23.26A27 27 0 0 1 74.27 38.16",
  "M76.59 45.31A27 27 0 0 1 68.76 69.42",
  "M62.68 73.84A27 27 0 0 1 37.32 73.84",
  "M31.24 69.42A27 27 0 0 1 23.41 45.31",
  "M25.73 38.16A27 27 0 0 1 46.24 23.26",
];
const OFF = "rgb(255 255 255 / 0.16)";

export function Mark({ size = 24, lit = 4, draw = false, className }: { size?: number; lit?: number; draw?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="17 17 66 66" aria-hidden className={className}>
      {ARCS.map((d, i) =>
        draw ? (
          <motion.path
            key={i}
            d={d}
            fill="none"
            stroke={i < lit ? "var(--color-volt)" : OFF}
            strokeWidth={10}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.15 + i * 0.09, duration: 0.38, ease: [0.2, 0.8, 0.2, 1] }}
          />
        ) : (
          <path key={i} d={d} fill="none" stroke={i < lit ? "var(--color-volt)" : OFF} strokeWidth={10} />
        ),
      )}
      {draw ? (
        <motion.circle
          cx="50"
          cy="50"
          r="9"
          fill="var(--color-volt)"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{ transformOrigin: "50px 50px" }}
          transition={{ delay: 0.62, type: "spring", stiffness: 420, damping: 16 }}
        />
      ) : (
        <circle cx="50" cy="50" r="9" fill="var(--color-volt)" />
      )}
    </svg>
  );
}
