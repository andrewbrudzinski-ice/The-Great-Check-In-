"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { CheckIcon, ChevronLeft, CrosshairIcon, PinIcon } from "@/components/Icons";
import { PageTitle, SectionTitle, Sheet } from "@/components/ui";
import { getCurrentFix } from "@/lib/geo";
import { activeGyms } from "@/lib/gyms";
import { useGame } from "@/lib/store";
import type { Gym } from "@/lib/types";

const CheckInMap = dynamic(() => import("@/components/CheckInMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface" />,
});

const field =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-ink outline-none placeholder:text-muted/60 focus:border-volt/60";

export default function GymsPage() {
  const { data, me, approveGym, archiveGym } = useGame();
  const [editing, setEditing] = useState<Gym | "new" | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gyms = activeGyms(data.gyms);
  const pending = gyms.filter((g) => g.status === "pending");
  const approved = gyms.filter((g) => g.status === "approved");
  const player = (id: string | null) => data.players.find((p) => p.id === id);
  const visits = (id: string) => data.checkIns.filter((c) => c.gymId === id).length;
  const isAdmin = !!me?.isAdmin;

  async function act(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div>
      <Link href="/map" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} /> Map
      </Link>
      <PageTitle
        eyebrow="Where check-ins count"
        title="Gyms"
        right={
          <button onClick={() => setEditing("new")} className="rounded-full bg-volt px-4 py-2 font-display text-sm font-black text-volt-ink">
            + Add gym
          </button>
        }
      />

      {gyms.length > 0 && (
        <div className="relative -mx-4 h-56 overflow-hidden border-y border-line sm:mx-0 sm:rounded-3xl sm:border">
          <CheckInMap checkIns={[]} players={data.players} gyms={gyms} timezone={data.settings.timezone} focusGymId={focus} className="h-full w-full" />
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        A check-in counts at any approved gym. When you tap Check In, the server picks the nearest gym you&apos;re inside.
        Gyms added by anyone other than the admin need <b className="text-ink-2">another player&apos;s approval</b>, so nobody can
        register their living room.
      </p>
      {error && <p className="mt-3 text-sm text-problem">{error}</p>}

      {gyms.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-4xl">🏋️</p>
          <p className="font-display mt-4 text-xl font-extrabold">No gyms yet.</p>
          <p className="mt-1 text-sm text-muted">Stand inside your gym and add it. Nobody can check in until there&apos;s one.</p>
        </div>
      )}

      {pending.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Waiting for approval</SectionTitle>
          <ul className="space-y-3">
            {pending.map((g) => {
              const mine = g.createdBy === me?.id;
              const by = player(g.createdBy);
              return (
                <motion.li key={g.id} layout className="rounded-3xl border border-dashed border-line-strong bg-surface/50 p-4">
                  <button onClick={() => setFocus(g.id)} className="block w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-display text-lg font-extrabold">{g.name}</p>
                      <span className="shrink-0 rounded-full bg-one/15 px-2 py-0.5 font-display text-[10px] font-black tracking-[0.1em] text-one">PENDING</span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      {by && <Avatar player={by} size={18} />}
                      Added by {by?.name ?? "someone"} · {g.radiusM} m radius
                    </p>
                  </button>
                  <div className="mt-4 flex gap-2">
                    {mine ? (
                      <p className="flex-1 self-center text-xs text-muted">Waiting for someone else to vouch for it.</p>
                    ) : (
                      <button
                        onClick={() => act(() => approveGym(g.id))}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-ink py-2.5 font-display text-sm font-black text-bg"
                      >
                        <CheckIcon size={16} strokeWidth={2.6} /> Approve
                      </button>
                    )}
                    {(mine || isAdmin) && (
                      <button onClick={() => setEditing(g)} className="rounded-2xl bg-surface-3 px-4 py-2.5 text-sm font-semibold">
                        Edit
                      </button>
                    )}
                    {(mine || isAdmin) && (
                      <button
                        onClick={() => confirm(`Remove ${g.name}?`) && act(() => archiveGym(g.id))}
                        className="rounded-2xl px-3 py-2.5 text-sm font-semibold text-muted hover:text-problem"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </section>
      )}

      {approved.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Approved</SectionTitle>
          <ul className="divide-y divide-line">
            {approved.map((g) => {
              const by = player(g.createdBy);
              const canRemove = isAdmin || g.createdBy === me?.id;
              return (
                <motion.li key={g.id} layout className="flex items-center gap-3 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-volt/12 text-volt">
                    <PinIcon size={18} />
                  </span>
                  <button onClick={() => setFocus(g.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-semibold">{g.name}</p>
                    <p className="truncate text-xs text-muted">
                      {g.radiusM} m radius · {visits(g.id)} check-in{visits(g.id) === 1 ? "" : "s"}
                      {by && ` · added by ${by.name}`}
                    </p>
                  </button>
                  {isAdmin && (
                    <button onClick={() => setEditing(g)} className="text-xs font-semibold text-muted hover:text-ink">
                      Edit
                    </button>
                  )}
                  {canRemove && (
                    <button
                      onClick={() => confirm(`Remove ${g.name}? Past check-ins there still count.`) && act(() => archiveGym(g.id))}
                      className="text-xs font-semibold text-muted hover:text-problem"
                    >
                      Remove
                    </button>
                  )}
                </motion.li>
              );
            })}
          </ul>
        </section>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)}>
        {editing !== null && <GymForm gym={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

function GymForm({ gym, onDone }: { gym: Gym | null; onDone: () => void }) {
  const { data, me, addGym, updateGym } = useGame();
  const [name, setName] = useState(gym?.name ?? "");
  const [lat, setLat] = useState(gym?.latitude.toString() ?? "");
  const [lng, setLng] = useState(gym?.longitude.toString() ?? "");
  const [radius, setRadius] = useState(gym?.radiusM ?? data.settings.checkInRadius);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latN = Number(lat);
  const lngN = Number(lng);
  const coordsOk = lat.trim() !== "" && lng.trim() !== "" && !isNaN(latN) && !isNaN(lngN) && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180;
  const needsApproval = !gym && !me?.isAdmin;

  async function locate() {
    setLocating(true);
    setError(null);
    try {
      const fix = await getCurrentFix();
      setLat(fix.latitude.toFixed(6));
      setLng(fix.longitude.toFixed(6));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't get your location.");
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const input = { name: name.trim(), latitude: latN, longitude: lngN, radiusM: radius };
      if (gym) await updateGym(gym.id, input);
      else await addGym(input);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the gym.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-1">
      <h3 className="font-display text-2xl font-black">{gym ? "Edit gym" : "Add a gym"}</h3>
      <div className="mt-4 space-y-3">
        <input className={field} placeholder="Gym name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <button
          onClick={locate}
          disabled={locating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-3 py-3 text-sm font-semibold"
        >
          <CrosshairIcon size={16} className={locating ? "animate-spin" : ""} />
          {locating ? "Locating…" : "Use my location (stand inside the gym)"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <input className={`${field} tabular text-sm`} inputMode="decimal" placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} aria-label="Latitude" />
          <input className={`${field} tabular text-sm`} inputMode="decimal" placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} aria-label="Longitude" />
        </div>
        <label className="block">
          <span className="mb-1.5 flex justify-between text-xs font-semibold text-ink-2">
            Check-in radius <span className="font-normal text-muted">{radius} m</span>
          </span>
          <input type="range" min={50} max={500} step={10} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-[#c8ff3d]" />
        </label>
        {coordsOk && (
          <div className="h-40 overflow-hidden rounded-2xl border border-line">
            <CheckInMap
              checkIns={[]}
              players={[]}
              timezone={data.settings.timezone}
              gyms={[
                {
                  id: "draft",
                  name: name || "New gym",
                  latitude: latN,
                  longitude: lngN,
                  radiusM: radius,
                  status: "approved",
                  createdBy: null,
                  approvedBy: null,
                  archived: false,
                  createdAt: "",
                },
              ]}
              className="h-full w-full"
            />
          </div>
        )}
        {needsApproval && (
          <p className="text-xs text-muted">Another player has to approve this gym before check-ins there count.</p>
        )}
        {error && <p className="text-sm text-problem">{error}</p>}
        <button
          onClick={save}
          disabled={busy || !coordsOk || !name.trim()}
          className="w-full rounded-2xl bg-volt py-3.5 font-display text-lg font-black text-volt-ink disabled:bg-surface-3 disabled:text-muted"
        >
          {busy ? "Saving…" : gym ? "Save changes" : needsApproval ? "Submit for approval" : "Add gym"}
        </button>
      </div>
    </div>
  );
}
