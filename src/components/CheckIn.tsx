"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { cooldownRemaining } from "@/lib/game";
import { approvedGyms } from "@/lib/gyms";
import { formatDistance } from "@/lib/geo";
import { useGame, type CheckInOutcome } from "@/lib/store";
import { line } from "@/lib/trash";
import type { CheckIn } from "@/lib/types";
import { formatDateTime, formatDuration, formatTime } from "@/lib/week";
import { RollingNumber } from "./RollingNumber";
import { CheckIcon, ClockIcon, CrosshairIcon, PinIcon } from "./Icons";
import { Sheet } from "./ui";
import { haptics } from "@/lib/haptics";

type Stage = "idle" | "locating" | "verifying";

export function CheckInButton() {
  const { checkIn, data, game, me, now, mode } = useGame();
  const [stage, setStage] = useState<Stage>("idle");
  const [success, setSuccess] = useState<{ checkIn: CheckIn; countBefore: number } | null>(null);
  const [failure, setFailure] = useState<CheckInOutcome | null>(null);

  const s = data.settings;
  const cooldown = me ? cooldownRemaining(data.checkIns, me.id, s.cooldownHours, now) : 0;
  const gyms = approvedGyms(data.gyms);
  const noGym = gyms.length === 0;
  const busy = stage !== "idle";
  const mine = game.standings.find((r) => r.player.id === me?.id);

  async function go() {
    if (busy || !me) return;
    haptics.tap();
    const before = mine?.count ?? 0;
    const outcome = await checkIn((st) => setStage(st));
    setStage("idle");
    if (outcome.kind === "result" && outcome.result.ok) {
      if (before + 1 === mine?.required) haptics.milestone();
      else haptics.success();
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
        <motion.button
          onClick={go}
          disabled={disabled}
          whileTap={disabled ? undefined : { scale: 0.97 }}
          transition={{ type: "spring", stiffness: 600, damping: 30 }}
          className={`relative flex h-[80px] w-full items-center justify-center gap-3 overflow-hidden rounded-[24px] font-display text-[23px] font-black tracking-[0.05em] uppercase transition-[background,color,box-shadow] duration-300 ${
            cooldown > 0 || noGym
              ? "bg-surface-2 text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
              : "bg-[linear-gradient(180deg,#d8ff6e_0%,var(--color-volt)_55%,#b9f02c_100%)] text-volt-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-3px_0_rgba(0,0,0,0.14),0_18px_40px_-16px_rgba(200,255,61,0.55)]"
          }`}
          aria-live="polite"
        >
          {busy && (
            <span
              aria-hidden
              className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.5)_50%,transparent_70%)] bg-[length:200%_100%]"
            />
          )}
          {busy ? (
            <CrosshairIcon size={26} strokeWidth={2.3} className="animate-spin [animation-duration:2.5s]" />
          ) : cooldown > 0 ? (
            <CheckIcon size={26} strokeWidth={2.6} className="text-volt" />
          ) : (
            <CrosshairIcon size={26} strokeWidth={2.3} />
          )}
          <span className="relative">{label}</span>
        </motion.button>
      </div>
      <p className="mt-2.5 text-center text-xs text-muted">
        {noGym ? (
          <>
            No gyms yet.{" "}
            <Link href="/gyms" className="text-ink-2 underline underline-offset-2">
              Add yours
            </Link>{" "}
            to start checking in.
          </>
        ) : cooldown > 0 ? (
          <>
            <ClockIcon size={12} className="mr-1 inline -translate-y-px" />
            Next check-in available in <span className="tabular text-ink-2">{formatDuration(cooldown)}</span>
          </>
        ) : (
          <>
            {gyms.length === 1 ? (
              <>
                Must be within {gyms[0].radiusM} m of <span className="text-ink-2">{gyms[0].name}</span>
              </>
            ) : (
              <>
                Counts at any of your{" "}
                <Link href="/gyms" className="text-ink-2 underline-offset-2 hover:underline">
                  {gyms.length} gyms
                </Link>
              </>
            )}
            {mode === "demo" && " · demo"}
          </>
        )}
      </p>

      <SuccessOverlay
        success={success}
        onClose={() => setSuccess(null)}
        required={mine?.required ?? s.weeklyRequirement}
        tz={s.timezone}
      />
      <FailureSheet outcome={failure} onClose={() => setFailure(null)} tz={s.timezone} demo={mode === "demo"} />
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
  const router = useRouter();
  const count = (success?.countBefore ?? 0) + 1;
  const justSafe = count === required;
  const already = count > required;
  const seed = success?.checkIn.id ?? "";
  // The count shows the old number first, then rolls to the new one.
  const [rolledFor, setRolledFor] = useState<string | null>(null);
  const shown = success && rolledFor === success.checkIn.id ? count : (success?.countBefore ?? 0);
  useEffect(() => {
    if (!success) return;
    const id = success.checkIn.id;
    const t = setTimeout(() => setRolledFor(id), 450);
    return () => clearTimeout(t);
  }, [success]);
  const segments = Math.min(Math.max(required, 1), 14);

  return (
    <AnimatePresence>
      {success && (
        <motion.div
          className="fixed inset-0 z-50 overflow-y-auto bg-bg/95 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Checked in"
        >
          <div className="relative mx-auto flex min-h-full w-full max-w-sm flex-col items-center justify-center px-6 pt-[calc(var(--safe-top)+32px)] pb-[calc(var(--safe-bottom)+28px)] text-center">
            <div className="relative grid h-36 w-36 place-items-center">
              <span aria-hidden className="absolute -inset-12 rounded-full bg-[radial-gradient(closest-side,rgba(200,255,61,0.28),transparent)]" />
              {[0, 1].slice(0, justSafe ? 2 : 1).map((i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="absolute inset-2 rounded-full border-2 border-volt"
                  initial={{ scale: 0.6, opacity: 0.8 }}
                  animate={{ scale: 2.3, opacity: 0 }}
                  transition={{ duration: 1, delay: 0.15 + i * 0.18, ease: [0.1, 0.7, 0.2, 1] }}
                />
              ))}
              <motion.div
                className="relative grid h-28 w-28 place-items-center rounded-full bg-volt text-volt-ink"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 16 }}
              >
                <svg width="58" height="58" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <motion.path
                    d="m5 12.5 4.5 4.5L19 7.5"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.22, duration: 0.42, ease: "easeOut" }}
                  />
                </svg>
              </motion.div>
            </div>

            <motion.h2
              className="font-big mt-8 text-[clamp(2rem,11vw,3.5rem)] leading-none whitespace-nowrap uppercase"
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.18 }}
            >
              {justSafe ? "Week secured" : "Checked in"}
            </motion.h2>
            <motion.p className="mt-3 text-[15px] text-ink-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              {justSafe ? line("safeLine", seed) : line("successLine", seed)}
            </motion.p>

            <motion.div className="mt-7 flex flex-col items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
              <span className="font-big flex items-end text-[88px] leading-[0.82]">
                <RollingNumber value={shown} />
                <span className="pb-1 text-[34px] text-faint">/{required}</span>
              </span>
              <div className="mt-4 grid w-56 gap-1" style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))` }} aria-hidden>
                {Array.from({ length: segments }, (_, i) => (
                  <span key={i} className="relative h-2 overflow-hidden rounded-[3px] bg-surface-3">
                    <span
                      className="absolute inset-y-0 left-0 rounded-[3px] bg-volt transition-[width] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                      style={{ width: i < shown ? "100%" : "0%" }}
                    />
                  </span>
                ))}
              </div>
              <p className="mt-3 font-mono text-[11px] tracking-[0.06em] text-muted uppercase">
                {justSafe ? "Safe this week" : already ? "Goal already secured · this one's for the ego" : `${required - count} more this week`}
              </p>
            </motion.div>

            <motion.dl
              className="mt-7 w-full space-y-1.5 border-t border-line pt-4 font-mono text-[11px] text-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
            >
              <div className="flex items-center justify-center gap-1.5">
                <ClockIcon size={13} />
                <dt className="sr-only">Time</dt>
                <dd className="text-ink-2">{formatDateTime(success.checkIn.checkedInAt, tz)}</dd>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <PinIcon size={13} />
                <dt className="sr-only">Location</dt>
                <dd>
                  <span className="text-ink-2">{success.checkIn.gymName}</span>
                  {success.checkIn.distanceM != null && <> · {formatDistance(success.checkIn.distanceM)} from the door</>}
                </dd>
              </div>
              <div className="tabular">
                {success.checkIn.latitude.toFixed(5)}, {success.checkIn.longitude.toFixed(5)}
              </div>
            </motion.dl>

            <motion.div className="mt-7 flex w-full flex-col gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}>
              <button className="pressable h-[54px] w-full rounded-2xl bg-ink text-[16px] font-semibold text-bg" onClick={onClose}>
                Back to the board
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const id = success.checkIn.id;
                  onClose();
                  router.push(`/map?checkin=${id}`);
                }}
                className="py-2 text-[13px] font-medium text-muted hover:text-ink"
              >
                View check-in receipt on the map
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FailureSheet({
  outcome,
  onClose,
  tz,
  demo,
}: {
  outcome: CheckInOutcome | null;
  onClose: () => void;
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
            You&apos;re <b className="text-ink">{formatDistance(r.distance)}</b> from the nearest gym, {r.gymName}. You need to be
            within {r.radius} m. The couch doesn&apos;t count.
            <span className="mt-3 block text-xs text-muted">
              At a gym that isn&apos;t listed?{" "}
              <Link href="/gyms" className="text-ink-2 underline underline-offset-2" onClick={onClose}>
                Add it
              </Link>{" "}
              — another player has to approve it.
              {demo && " (Demo: you can approve it yourself by signing in as someone else.)"}
            </span>
          </>
        );
        break;
      case "gym_pending":
        emoji = "⏳";
        title = "Almost.";
        body = (
          <>
            You&apos;re at <b className="text-ink">{r.gymName}</b>, but it&apos;s still waiting for another player to approve it.
            Once someone vouches for it, check-ins here count.{" "}
            <Link href="/gyms" className="text-ink-2 underline underline-offset-2" onClick={onClose}>
              See gyms
            </Link>
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
        title = "No gyms yet";
        body = (
          <>
            Add your gym first.{" "}
            <Link href="/gyms" className="text-ink-2 underline underline-offset-2" onClick={onClose}>
              Go to Gyms
            </Link>
          </>
        );
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
