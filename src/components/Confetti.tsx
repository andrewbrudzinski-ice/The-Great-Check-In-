"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";

const COLORS = ["#c8ff3d", "#3dd9ff", "#ff5c8a", "#facc15", "#ffffff"];

/** A one-shot burst of ~36 pieces. Cheap: transforms + opacity only. */
export function Confetti({ count = 36, spread = 260 }: { count?: number; spread?: number }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const dist = spread * (0.45 + Math.random() * 0.55);
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist * 0.8 - 40,
          rot: Math.random() * 720 - 360,
          color: COLORS[i % COLORS.length],
          w: 5 + Math.random() * 5,
          h: 8 + Math.random() * 8,
          delay: Math.random() * 0.12,
          round: i % 4 === 0,
        };
      }),
    [count, spread],
  );
  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-visible" aria-hidden>
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ width: p.w, height: p.round ? p.w : p.h, background: p.color, borderRadius: p.round ? 999 : 2 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 140], opacity: [1, 1, 0], rotate: p.rot, scale: 1 }}
          transition={{ duration: 1.5, delay: p.delay, ease: [0.15, 0.7, 0.4, 1], times: [0, 0.55, 1] }}
        />
      ))}
    </div>
  );
}
