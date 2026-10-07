"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { approvedGyms } from "@/lib/gyms";
import { useGame } from "@/lib/store";
import { formatDateTime } from "@/lib/week";
import { Avatar } from "./Avatar";
import { CheckIcon } from "./Icons";

const field =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-ink outline-none placeholder:text-muted/60 focus:border-volt/60";

/** "2026-10-07T18:30" in the phone's local time, for <input type="datetime-local">. */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Admin-only: add a check-in for someone who forgot to tap the button. */
export function AdminCheckIn() {
  const { data, adminCheckIn, adminRemoveCheckIn } = useGame();
  const gyms = approvedGyms(data.gyms);
  const tz = data.settings.timezone;
  const [userId, setUserId] = useState<string | null>(null);
  const [gymId, setGymId] = useState<string>("");
  const [when, setWhen] = useState(() => toLocalInput(new Date()));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const player = data.players.find((p) => p.id === userId) ?? null;
  const name = (id: string | null) => data.players.find((p) => p.id === id)?.name ?? "someone";
  const manual = useMemo(() => data.checkIns.filter((c) => c.manual).slice(-8).reverse(), [data.checkIns]);

  // Default the gym to wherever that player usually goes.
  function pickPlayer(id: string) {
    setUserId(id);
    setDone(null);
    setError(null);
    const counts = new Map<string, number>();
    for (const c of data.checkIns) if (c.userId === id && c.gymId) counts.set(c.gymId, (counts.get(c.gymId) ?? 0) + 1);
    const usual = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g).find((g) => gyms.some((x) => x.id === g));
    setGymId(usual ?? gyms[0]?.id ?? "");
  }

  async function submit() {
    if (!userId || !gymId || !when) return;
    setBusy(true);
    setError(null);
    try {
      const at = new Date(when).toISOString();
      await adminCheckIn({ userId, gymId, at, note });
      setDone(`${name(userId)} is checked in at ${gyms.find((g) => g.id === gymId)?.name} · ${formatDateTime(at, tz)}`);
      setNote("");
      setUserId(null);
      setWhen(toLocalInput(new Date()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add the check-in.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, who: string) {
    if (!confirm(`Remove this manual check-in for ${who}?`)) return;
    try {
      await adminRemoveCheckIn(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove it.");
    }
  }

  if (gyms.length === 0) {
    return <p className="text-sm text-muted">Add an approved gym first, then you can check people in here.</p>;
  }

  const minWhen = toLocalInput(new Date(Date.now() - 14 * 86400000));
  const maxWhen = toLocalInput(new Date());

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Someone forgot to tap the button? Add it for them. It shows up as <b className="text-ink-2">added by you</b>, not GPS-verified,
        so everyone can see it.
      </p>

      <p className="mb-2 text-xs font-semibold text-ink-2">Who forgot?</p>
      <div className="flex flex-wrap gap-2">
        {data.players.map((p) => (
          <button
            key={p.id}
            onClick={() => pickPlayer(p.id)}
            aria-pressed={userId === p.id}
            className={`flex items-center gap-2 rounded-full py-1 pr-3.5 pl-1 text-sm font-semibold transition-colors ${
              userId === p.id ? "bg-ink text-bg" : "bg-surface-2 text-ink-2"
            }`}
          >
            <Avatar player={p} size={28} />
            {p.name}
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {player && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="space-y-3 pt-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-2">Gym</span>
                <select className={field} value={gymId} onChange={(e) => setGymId(e.target.value)}>
                  {gyms.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 flex justify-between text-xs font-semibold text-ink-2">
                  When
                  <button type="button" onClick={() => setWhen(toLocalInput(new Date()))} className="font-normal text-muted underline-offset-2 hover:underline">
                    Now
                  </button>
                </span>
                <input type="datetime-local" className={field} value={when} min={minWhen} max={maxWhen} onChange={(e) => setWhen(e.target.value)} />
              </label>
              <input className={field} placeholder="Note (optional), e.g. phone died" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} />
              <button
                onClick={submit}
                disabled={busy || !gymId || !when}
                className="w-full rounded-2xl bg-volt py-3.5 font-display text-base font-black text-volt-ink disabled:bg-surface-3 disabled:text-muted"
              >
                {busy ? "Checking in…" : `Check ${player.name} in`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="mt-3 text-sm text-problem">{error}</p>}
      {done && (
        <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-1.5 text-sm text-safe">
          <CheckIcon size={16} strokeWidth={2.6} /> {done}
        </motion.p>
      )}

      {manual.length > 0 && (
        <div className="mt-6">
          <p className="mb-1 text-xs font-semibold text-ink-2">Recent manual check-ins</p>
          <ul className="divide-y divide-line">
            {manual.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <b className="font-semibold">{name(c.userId)}</b>
                  <span className="text-muted"> · {c.gymName}</span>
                  <span className="block truncate text-xs text-muted">
                    {formatDateTime(c.checkedInAt, tz)} · added by {name(c.addedBy)}
                    {c.note && ` · “${c.note}”`}
                  </span>
                </span>
                <button onClick={() => remove(c.id, name(c.userId))} className="shrink-0 text-xs font-semibold text-muted hover:text-problem">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
