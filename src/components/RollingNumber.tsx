"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

/**
 * A number that rolls like an odometer when it changes: the old value slides
 * out, the new one slides in (up when it grows, down when it shrinks). It
 * never animates on first render, so opening a screen is calm. At rest only
 * the real number is in the page, so screen readers and copy/paste see it.
 */
export function RollingNumber({ value, className = "", format }: { value: number; className?: string; format?: (n: number) => string }) {
  const reduce = useReducedMotion();
  const prev = useRef(value);
  const dir = value >= prev.current ? 1 : -1;
  useEffect(() => {
    prev.current = value;
  }, [value]);

  return (
    <span className={`relative inline-flex overflow-hidden align-bottom tabular ${className}`} style={{ lineHeight: "inherit" }}>
      <AnimatePresence initial={false} mode="popLayout" custom={dir}>
        <motion.span
          key={value}
          custom={dir}
          className="inline-block"
          variants={{
            enter: (d: number) => ({ y: reduce ? 0 : `${d * 100}%`, opacity: reduce ? 1 : 0 }),
            center: { y: 0, opacity: 1 },
            exit: (d: number) => ({ y: reduce ? 0 : `${d * -100}%`, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduce ? 0 : 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {format ? format(value) : value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
