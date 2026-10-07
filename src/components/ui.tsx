"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { STATUS_META, type Status } from "@/lib/game";
import { FlameIcon, XIcon } from "./Icons";

/** One segment per required check-in; overflow shows as a +N chip. */
export function SegmentBar({
  count,
  required,
  status,
  height = 8,
}: {
  count: number;
  required: number;
  status: Status;
  height?: number;
}) {
  const color = STATUS_META[status].color;
  const extra = Math.max(0, count - required);
  return (
    <div className="flex items-center gap-2">
      <div
        className="grid flex-1 gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${required}, minmax(0, 1fr))` }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={required}
        aria-valuenow={Math.min(count, required)}
      >
        {Array.from({ length: required }, (_, i) => (
          <span key={i} className="relative overflow-hidden rounded-full bg-surface-3" style={{ height }}>
            <motion.span
              className="absolute inset-0 origin-left rounded-full"
              style={{ background: color }}
              initial={false}
              animate={{ scaleX: i < count ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 26, delay: i < count ? i * 0.05 : 0 }}
            />
          </span>
        ))}
      </div>
      {extra > 0 && (
        <span className="tabular rounded-full bg-safe/15 px-1.5 py-0.5 text-[10px] font-bold text-safe">+{extra}</span>
      )}
    </div>
  );
}

export function StatusPill({ status, label, className = "" }: { status: Status; label?: string; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] font-display text-[10px] font-bold tracking-[0.08em] whitespace-nowrap uppercase ${className}`}
      style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {label ?? meta.label}
    </span>
  );
}

/** Circular progress. */
export function Ring({
  value,
  max,
  size = 120,
  stroke = 10,
  color = "var(--color-volt)",
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, max ? value / max : 0);
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: "spring", stiffness: 60, damping: 16 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function StreakBadge({ weeks, size = "sm" }: { weeks: number; size?: "sm" | "lg" }) {
  const hot = weeks >= 3;
  const fire = weeks >= 6 ? "🔥🔥" : weeks >= 1 ? "🔥" : "";
  if (size === "lg") {
    return (
      <span className="inline-flex items-baseline gap-1.5">
        <span className="font-display tabular text-4xl font-black">{weeks}</span>
        <span className="text-sm text-muted">week{weeks === 1 ? "" : "s"}</span>
        {fire && <span className="text-xl">{fire}</span>}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular ${
        weeks === 0 ? "text-muted" : hot ? "bg-orange-500/15 text-orange-300" : "bg-surface-3 text-ink-2"
      }`}
      title={`${weeks}-week streak`}
    >
      <FlameIcon size={12} strokeWidth={2.2} />
      {weeks}
    </span>
  );
}

/**
 * The part of the screen actually visible. On iPhone Safari the keyboard and
 * toolbars shrink this without resizing the page, so fixed-bottom UI pinned
 * to the page ends up floating mid-screen or hidden behind the keyboard.
 */
function useVisibleViewport(active: boolean) {
  const [vp, setVp] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    const update = () => setVp(vv ? { top: vv.offsetTop, height: vv.height } : { top: 0, height: window.innerHeight });
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [active]);
  return vp;
}

/** Bottom sheet modal that always fits the visible screen. */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const vp = useVisibleViewport(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Keep the page behind from scrolling while the sheet is up.
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = prev;
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-x-0 z-50 flex items-end justify-center"
          style={vp ? { top: vp.top, height: vp.height } : { top: 0, bottom: 0 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button aria-label="Close" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative flex w-full max-w-lg flex-col rounded-t-[28px] border-t border-line-strong bg-surface"
            style={{ maxHeight: vp ? vp.height - 12 : "calc(100dvh - 12px)" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            <div className="mx-auto mt-3 mb-4 h-1 w-10 shrink-0 rounded-full bg-line-strong" />
            <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 z-10 rounded-full p-1.5 text-muted hover:bg-surface-3 hover:text-ink">
              <XIcon size={18} />
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(var(--safe-bottom)+24px)]">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="eyebrow rule flex-1">{children}</h2>
      {right}
    </div>
  );
}

export function PageTitle({ eyebrow, title, right }: { eyebrow?: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="font-display text-[34px] leading-[0.95] font-black">{title}</h1>
      </div>
      {right}
    </header>
  );
}
