"use client";

import { motion } from "motion/react";
import { formatDistance } from "@/lib/geo";
import type { CheckIn, Player, Settings } from "@/lib/types";
import { formatExact } from "@/lib/week";
import { Avatar } from "./Avatar";
import { CheckIcon, ClockIcon, CrosshairIcon, PinIcon, XIcon } from "./Icons";

/**
 * Proof of a check-in: where the phone actually was, how precise the GPS fix
 * was, how far from the gym, and the server's timestamp.
 */
export function Receipt({
  checkIn,
  player,
  settings,
  onClose,
}: {
  checkIn: CheckIn;
  player: Player;
  settings: Settings;
  onClose?: () => void;
}) {
  const radius = checkIn.radiusM ?? settings.checkInRadius;
  const d = checkIn.distanceM;
  const coords = `${checkIn.latitude.toFixed(6)}, ${checkIn.longitude.toFixed(6)}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${checkIn.latitude},${checkIn.longitude}`;
  // How much of the allowed zone they used — 0% is dead center.
  const pct = d != null ? Math.min(100, (d / radius) * 100) : null;

  return (
    <motion.section
      key={checkIn.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-safe/25 bg-[linear-gradient(160deg,rgba(74,222,128,0.09),transparent_60%)] p-4"
      aria-label="Check-in receipt"
    >
      <div className="flex items-center gap-3">
        <Avatar player={player} size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight font-extrabold">{player.name}</p>
          <p className="inline-flex items-center gap-1 font-display text-[10px] font-black tracking-[0.12em] text-safe">
            <CheckIcon size={12} strokeWidth={3} /> VERIFIED AT {checkIn.gymName.toUpperCase()}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close receipt" className="rounded-full p-1.5 text-muted hover:bg-surface-3 hover:text-ink">
            <XIcon size={16} />
          </button>
        )}
      </div>

      {pct != null && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted">Distance from the gym</span>
            <span>
              <b className="font-display tabular text-base">{formatDistance(d!)}</b>
              <span className="text-muted"> / {radius} m allowed</span>
            </span>
          </div>
          <div className="relative mt-2 h-2 rounded-full bg-surface-3">
            <motion.span
              className="absolute inset-y-0 left-0 rounded-full bg-safe"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(pct, 3)}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-1 gap-2.5 text-sm">
        <Row icon={<ClockIcon size={15} />} label="Server time">
          {formatExact(checkIn.checkedInAt, settings.timezone)}
        </Row>
        <Row icon={<PinIcon size={15} />} label="Phone location">
          <span className="tabular">{coords}</span>{" "}
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs whitespace-nowrap text-ink-2 underline underline-offset-2 hover:text-ink">
            Open in Maps ↗
          </a>
        </Row>
        <Row icon={<CrosshairIcon size={15} />} label="GPS accuracy">
          {checkIn.accuracy != null ? (
            <>
              ±{formatDistance(checkIn.accuracy)}{" "}
              <span className="text-xs text-muted">{checkIn.accuracy <= 30 ? "· precise" : checkIn.accuracy <= 100 ? "· decent" : "· fuzzy"}</span>
            </>
          ) : (
            <span className="text-muted">not reported</span>
          )}
        </Row>
      </dl>
    </motion.section>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold tracking-wider text-muted uppercase">{label}</dt>
        <dd className="text-ink">{children}</dd>
      </div>
    </div>
  );
}
