"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cooldownRemaining } from "@/lib/game";
import { formatDistance } from "@/lib/geo";
import { useGame, type CheckInOutcome } from "@/lib/store";
import { line } from "@/lib/trash";
import type { CheckIn } from "@/lib/types";
import { formatDateTime, formatDuration, formatTime } from "@/lib/week";
import { Confetti } from "./Confetti";
import { CheckIcon, ClockIcon, CrosshairIcon, PinIcon } from "./Icons";
import { Sheet } from "./ui";

type Stage = "idle" | "locating" | "verifying";

export function CheckInButton() {
  const { checkIn, data, game, me, now, mode } = useGame();
  const [stage, setStage] = useState<Stage>("idle");
  const [success, setSuccess] = useState<{ checkIn: CheckIn; countBefore: number } | null>(null);
  const [failure, setFailure] = useState<CheckInOutcome | null>(null);

  const s = data.settings;
  const cooldown = me ? cooldownRemaining(data.checkIns, me.id, s.cooldownHours, now) : 0;
  const noGym = s.gymLatitude == null || s.gymLongitude == null;
  const busy = stage !== "idle";
  const mine = game.standings.find((r) => r.player.id === me?.id);

  async function go() {
    if (busy || !me) return;
    navigator.vibrate?.(12);
    const before = mine?.count ?? 0;
    const outcome = await checkIn((st) => setStage(st));
    setStage("idle");
    if (outcome.kind === "result" && outcome.result.ok) {
      navigator.vibrate?.([20, 40, 60]);
      setSuccess({ checkIn: outcome.result.checkIn, countBefore: before });
    } else {
      setFailure(outcome);
    }
  }

  const disabled = busy || cooldown > 0 || noGym;
  const label =
    stage === "locating" ? "Finding you…" : stage === "verifying" ? "Verifying…" : cooldown > 0 ? "Checked in" : "Check in";

  return (
    <>
      <div className="relative">
        {!disabled && (
          <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-[28px] bg-volt/40" />
        )}
        <motion.button
          onClick={go}
          disabled={disabled}
          whileTap={disabled ? undefined : { scale: 0.97 }}
          className={`relative flex h-[84px] w-full items-center justify-center gap-3 overflow-hidden rounded-[28px] font-display text-[26px] font-black tracking-[0.04em] uppercase transition-colors ${
            cooldown > 0 || noGym
              ? "bg-surface-2 text-ink-2 ring-1 ring-line-strong"
              : "bg-volt text-volt-ink shadow-[0_10px_40px_-8px_rgba(200,255,61,0.55)]"
          }`}
          aria-live="polite"
        >
          {busy && (
            <span
              aria-hidden
              className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.45)_50%,transparent_70%)] bg-[length:200%_100%]"
            />
          )}
          {busy ? (
            <CrosshairIcon size={28} strokeWidth={2.4} className="animate-spin [animation-duration:2.5s]" />
          ) : cooldown > 0 ? (
            <CheckIcon size={26} strokeWidth={2.6} className="text-safe" />
          ) : (
            <PinIcon size={26} strokeWidth={2.6} />
          )}
          <span className="relative">{label}</span>
        </motion.button>
      </div>
      <p className="mt-2.5 text-center text-xs text-muted">
        {noGym ? (
          <>The gym location isn&apos;t set yet. An admin needs to set it in Settings.</>
        ) : cooldown > 0 ? (
          <>
            <ClockIcon size={12} className="mr-1 inline -translate-y-px" />
            Next check-in available in <span className="tabular text-ink-2">{formatDuration(cooldown)}</span>
          </>
        ) : (
          <>
            Must be within {s.checkInRadius} m of <span className="text-ink-2">{s.gymName}</span>
            {mode === "demo" && " · demo"}
          </>
        )}
      </p>

      <SuccessOverlay
        success={success}
        onClose={() => setSuccess(null)}
        required={s.weeklyRequirement}
        tz={s.timezone}
      />
      <FailureSheet outcome={failure} onClose={() => setFailure(null)} gymName={s.gymName} tz={s.timezone} demo={mode === "demo"} />
    </>
  );
}

function SuccessOverlay({
  success,
  onClose,
  required,
  tz,
}: {
  success: { checkIn: CheckIn; countBefore: number } | null;
  onClose: () => void;
  required: number;
  tz: string;
}) {
  const count = (success?.countBefore ?? 0) + 1;
  const justSafe = count === required;
  const already = count > required;
  const seed = success?.checkIn.id ?? "";

  return (
    <AnimatePresence>
      {success && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-bg/95 px-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Checked in"
        >
          <div className="relative flex w-full max-w-sm flex-col items-center text-center">
            <div className="relative grid place-items-center">
              <motion.span
                className="absolute h-40 w-40 rounded-full border-2 border-volt"
                initial={{ scale: 0.6, opacity: 0.9 }}
                animate={{ scale: 2.2, opacity: 0 }}
                transition={{ duration: 1.1, ease: "easeOut" }}
              />
              <motion.div
                className="grid h-32 w-32 place-items-center rounded-full bg-volt text-volt-ink shadow-[0_0_80px_-10px_rgba(200,255,61,0.8)]"
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
              >
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <motion.path
                    d="m5 12.5 4.5 4.5L19 7.5"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.25, duration: 0.4, ease: "easeOut" }}
                  />
                </svg>
              </motion.div>
              {justSafe && <Confetti count={44} spread={300} />}
            </div>

            <motion.h2
              className="font-display mt-10 text-[clamp(2.5rem,13vw,3.75rem)] leading-none font-black whitespace-nowrap"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              CHECKED IN.
            </motion.h2>
            <motion.p className="mt-3 text-lg text-ink-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              {justSafe ? line("safeLine", seed) : line("successLine", seed)}
            </motion.p>

            <motion.div
              className="mt-8 flex items-center gap-3 rounded-2xl border border-line bg-surface/80 px-5 py-3"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <span className="font-display tabular text-4xl font-black">
                {count}
                <span className="text-muted">/{required}</span>
              </span>
              <span className="text-left text-xs leading-tight text-muted">
                {justSafe ? (
                  <span className="font-display text-base font-black tracking-wide text-safe">SAFE ✓</span>
                ) : already ? (
                  <>
                    Goal already secured.
                    <br />
                    This one&apos;s for the ego.
                  </>
                ) : (
                  <>
                    {required - count} more
                    <br />
                    this week
                  </>
                )}
              </span>
            </motion.div>

            <motion.dl
              className="mt-6 space-y-1.5 text-sm text-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
            >
              <div className="flex items-center justify-center gap-1.5">
                <ClockIcon size={14} />
                <dt className="sr-only">Time</dt>
                <dd className="text-ink-2">{formatDateTime(success.checkIn.checkedInAt, tz)}</dd>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <PinIcon size={14} />
                <dt className="sr-only">Location</dt>
                <dd>
                  <span className="text-ink-2">{success.checkIn.gymName}</span>
                  {success.checkIn.distanceM != null && <> · {formatDistance(success.checkIn.distanceM)} from the door</>}
                </dd>
              </div>
              <div className="tabular text-[11px]">
                {success.checkIn.latitude.toFixed(5)}, {success.checkIn.longitude.toFixed(5)}
              </div>
            </motion.dl>

            <motion.button
              className="mt-10 rounded-full bg-surface-3 px-8 py-3 font-display text-sm font-bold tracking-wide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              onClick={onClose}
            >
              Back to the board
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FailureSheet({
  outcome,
  onClose,
  gymName,
  tz,
  demo,
}: {
  outcome: CheckInOutcome | null;
  onClose: () => void;
  gymName: string;
  tz: string;
  demo: boolean;
}) {
  let emoji = "🤨";
  let title = "Check-in failed";
  let body: React.ReactNode = null;

  if (outcome?.kind === "location") {
    const code = outcome.error.code;
    emoji = "📍";
    if (code === "denied") {
      title = "We need your location";
      body = (
        <>
          Location is only read the moment you tap Check In, to prove you&apos;re at the gym. Nothing is tracked in the
          background. Enable location for this site in your browser settings, then try again.
        </>
      );
    } else if (code === "timeout") {
      title = "No GPS signal";
      body = <>Couldn&apos;t get a fix in time. Step near a window or the entrance and try again.</>;
    } else {
      title = "Location unavailable";
      body = <>{outcome.error.message} Try again in a moment.</>;
    }
  } else if (outcome?.kind === "result" && !outcome.result.ok) {
    const r = outcome.result;
    switch (r.code) {
      case "too_far":
        emoji = "🛋️";
        title = "Nice try.";
        body = (
          <>
            You&apos;re <b className="text-ink">{formatDistance(r.distance)}</b> from {gymName}. You need to be within{" "}
            {r.radius} m. The couch doesn&apos;t count.
            {demo && (
              <span className="mt-3 block text-xs text-muted">
                Demo tip: move the gym to your current spot in Settings → Gym → “Use my location”.
              </span>
            )}
          </>
        );
        break;
      case "cooldown":
        emoji = "⏳";
        title = "Easy, tiger.";
        body = (
          <>
            You already checked in recently. One check-in per visit — next one unlocks at{" "}
            <b className="text-ink">{formatTime(r.nextAllowedAt, tz)}</b>.
          </>
        );
        break;
      case "low_accuracy":
        emoji = "📡";
        title = "GPS is too fuzzy";
        body = <>Your location is only accurate to ±{formatDistance(r.accuracy)}. Turn on precise location and try again.</>;
        break;
      case "no_gym":
        emoji = "🗺️";
        title = "No gym configured";
        body = <>An admin needs to set the gym location in Settings first.</>;
        break;
      case "not_authenticated":
      case "no_profile":
        title = "You're not signed in";
        body = <>Sign in again and retry.</>;
        break;
      case "invalid_location":
        title = "Weird location";
        body = <>Your device returned an invalid position. Try again.</>;
        break;
      case "error":
        title = "Something broke";
        body = <>{r.message}</>;
        break;
    }
  }

  return (
    <Sheet open={!!outcome} onClose={onClose}>
      <div className="pt-1 pb-2 text-center">
        <div className="animate-shake text-5xl">{emoji}</div>
        <h3 className="font-display mt-4 text-3xl font-black">{title}</h3>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-2">{body}</p>
        <button onClick={onClose} className="mt-6 w-full rounded-2xl bg-surface-3 py-3.5 font-display font-bold">
          Got it
        </button>
      </div>
    </Sheet>
  );
}
