"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { ChevronLeft, CrosshairIcon } from "@/components/Icons";
import { SectionTitle } from "@/components/ui";
import { resetDemo } from "@/lib/backend/demo";
import { AVATAR_CHOICES, PLAYER_COLORS } from "@/lib/config";
import { getCurrentFix } from "@/lib/geo";
import { useGame } from "@/lib/store";
import type { Player, Settings } from "@/lib/types";
import { isValidTimezone } from "@/lib/week";

const CheckInMap = dynamic(() => import("@/components/CheckInMap"), { ssr: false });

const field =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-ink outline-none placeholder:text-muted/60 focus:border-volt/60 disabled:opacity-60";

export default function SettingsPage() {
  const { data, me, mode, signOut } = useGame();
  const isAdmin = !!me?.isAdmin || mode === "demo";
  const players = data.players;

  return (
    <div>
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} /> Back
      </Link>
      <header className="mb-8">
        <p className="eyebrow mb-1.5">Club admin</p>
        <h1 className="font-display text-[34px] leading-[0.95] font-black">Settings</h1>
        {!isAdmin && (
          <p className="mt-2 text-sm text-muted">You can edit your own profile. Club rules are locked to the admin.</p>
        )}
      </header>

      <section>
        <SectionTitle>Players</SectionTitle>
        <div className="space-y-3">
          {players.map((p) => (
            <PlayerEditor key={p.id} player={p} canEdit={isAdmin || p.id === me?.id} />
          ))}
        </div>
      </section>

      <GymSection settings={data.settings} disabled={!isAdmin} />
      <RulesSection settings={data.settings} disabled={!isAdmin} />
      <AppSection settings={data.settings} disabled={!isAdmin} />

      <section className="mt-12 space-y-2">
        {mode === "demo" && (
          <button
            onClick={() => {
              if (confirm("Wipe demo data and reseed?")) {
                resetDemo();
                location.href = "/";
              }
            }}
            className="w-full rounded-2xl border border-line py-3 text-sm font-semibold text-muted hover:text-ink"
          >
            Reset demo data
          </button>
        )}
        <button onClick={signOut} className="w-full rounded-2xl border border-line py-3 text-sm font-semibold text-muted hover:text-ink">
          Sign out
        </button>
      </section>
    </div>
  );
}

function useSaver() {
  const [state, setState] = useState<"idle" | "saving" | "saved" | { error: string }>("idle");
  useEffect(() => {
    if (state !== "saved") return;
    const t = setTimeout(() => setState("idle"), 1800);
    return () => clearTimeout(t);
  }, [state]);
  const run = async (fn: () => Promise<void>) => {
    setState("saving");
    try {
      await fn();
      setState("saved");
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : "Couldn't save." });
    }
  };
  return { state, run };
}

function SaveRow({ state, disabled, onSave }: { state: ReturnType<typeof useSaver>["state"]; disabled?: boolean; onSave: () => void }) {
  return (
    <div className="mt-4 flex items-center justify-end gap-3">
      {typeof state === "object" && <span className="flex-1 text-xs text-problem">{state.error}</span>}
      {state === "saved" && <span className="text-xs font-semibold text-safe">Saved ✓</span>}
      <button
        onClick={onSave}
        disabled={disabled || state === "saving"}
        className="rounded-full bg-volt px-5 py-2 font-display text-sm font-bold text-volt-ink disabled:bg-surface-3 disabled:text-muted"
      >
        {state === "saving" ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between text-xs font-semibold text-ink-2">
      {children}
      {hint && <span className="font-normal text-muted">{hint}</span>}
    </span>
  );
}

function PlayerEditor({ player, canEdit }: { player: Player; canEdit: boolean }) {
  const { updatePlayer } = useGame();
  const [name, setName] = useState(player.name);
  const [avatar, setAvatar] = useState(player.avatar);
  const [color, setColor] = useState(player.color);
  const [open, setOpen] = useState(false);
  const { state, run } = useSaver();
  const dirty = name !== player.name || avatar !== player.avatar || color !== player.color;

  return (
    <div className="rounded-2xl border border-line bg-surface/50">
      <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Avatar player={{ name, avatar, color }} size={40} />
        <span className="flex-1 font-display text-lg font-extrabold">{name || "—"}</span>
        {player.isAdmin && <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-muted">ADMIN</span>}
        <span className="text-xs text-muted">{canEdit ? (open ? "Close" : "Edit") : ""}</span>
      </button>
      {open && canEdit && (
        <div className="border-t border-line p-3">
          <label className="block">
            <Label>Name</Label>
            <input className={field} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="mt-4">
            <Label hint="or paste an image URL">Avatar</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {AVATAR_CHOICES.map((a) => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={`grid aspect-square place-items-center rounded-xl text-xl ${avatar === a ? "bg-surface-3 ring-1 ring-volt" : "bg-surface-2"}`}
                  aria-label={`Avatar ${a}`}
                >
                  {a}
                </button>
              ))}
            </div>
            <input
              className={`${field} mt-2 text-sm`}
              placeholder="https://…/me.jpg"
              value={/^https?:\/\//.test(avatar) ? avatar : ""}
              onChange={(e) => setAvatar(e.target.value || AVATAR_CHOICES[0])}
            />
          </div>
          <div className="mt-4">
            <Label>Color</Label>
            <div className="flex gap-2">
              {PLAYER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className="h-8 w-8 rounded-full"
                  style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${c}` : undefined }}
                />
              ))}
            </div>
          </div>
          <SaveRow state={state} disabled={!dirty || !name.trim()} onSave={() => run(() => updatePlayer(player.id, { name: name.trim(), avatar, color }))} />
        </div>
      )}
    </div>
  );
}

function GymSection({ settings, disabled }: { settings: Settings; disabled: boolean }) {
  const { updateSettings } = useGame();
  const [gymName, setGymName] = useState(settings.gymName);
  const [lat, setLat] = useState(settings.gymLatitude?.toString() ?? "");
  const [lng, setLng] = useState(settings.gymLongitude?.toString() ?? "");
  const [radius, setRadius] = useState(settings.checkInRadius);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);
  const { state, run } = useSaver();

  const latN = Number(lat);
  const lngN = Number(lng);
  const coordsOk = lat !== "" && lng !== "" && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180 && !isNaN(latN) && !isNaN(lngN);

  async function useMyLocation() {
    setLocating(true);
    setLocErr(null);
    try {
      const fix = await getCurrentFix();
      setLat(fix.latitude.toFixed(6));
      setLng(fix.longitude.toFixed(6));
    } catch (e) {
      setLocErr(e instanceof Error ? e.message : "Couldn't get location.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <section className="mt-10">
      <SectionTitle>Gym</SectionTitle>
      <div className="space-y-4">
        <label className="block">
          <Label>Gym name</Label>
          <input className={field} value={gymName} onChange={(e) => setGymName(e.target.value)} disabled={disabled} maxLength={60} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <Label>Latitude</Label>
            <input className={`${field} tabular`} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} disabled={disabled} placeholder="40.7359" />
          </label>
          <label className="block">
            <Label>Longitude</Label>
            <input className={`${field} tabular`} inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} disabled={disabled} placeholder="-73.9911" />
          </label>
        </div>
        {!disabled && (
          <button
            onClick={useMyLocation}
            disabled={locating}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong py-3 text-sm font-semibold text-ink-2 hover:text-ink"
          >
            <CrosshairIcon size={16} className={locating ? "animate-spin" : ""} />
            {locating ? "Locating…" : "Use my location (stand inside the gym)"}
          </button>
        )}
        {locErr && <p className="text-xs text-problem">{locErr}</p>}
        <label className="block">
          <Label hint={`${radius} m`}>Check-in radius</Label>
          <input
            type="range"
            min={50}
            max={500}
            step={10}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            disabled={disabled}
            className="w-full accent-[#c8ff3d]"
          />
        </label>
        {coordsOk && (
          <div className="h-48 overflow-hidden rounded-2xl border border-line">
            <CheckInMap
              checkIns={[]}
              players={[]}
              settings={{ ...settings, gymName, gymLatitude: latN, gymLongitude: lngN, checkInRadius: radius }}
              className="h-full w-full"
            />
          </div>
        )}
      </div>
      {!disabled && (
        <SaveRow
          state={state}
          disabled={!coordsOk || !gymName.trim()}
          onSave={() => run(() => updateSettings({ gymName: gymName.trim(), gymLatitude: latN, gymLongitude: lngN, checkInRadius: radius }))}
        />
      )}
    </section>
  );
}

function RulesSection({ settings, disabled }: { settings: Settings; disabled: boolean }) {
  const { updateSettings } = useGame();
  const [req, setReq] = useState(settings.weeklyRequirement);
  const [cooldown, setCooldown] = useState(settings.cooldownHours);
  const [punishment, setPunishment] = useState(settings.punishment);
  const [tz, setTz] = useState(settings.timezone);
  const { state, run } = useSaver();
  const tzOk = isValidTimezone(tz);

  return (
    <section className="mt-10">
      <SectionTitle>Rules &amp; punishment</SectionTitle>
      <div className="space-y-4">
        <label className="block">
          <Label hint="the whole group does it if anyone misses">Group punishment</Label>
          <textarea
            className={`${field} min-h-[80px] resize-none font-display text-lg font-bold`}
            value={punishment}
            onChange={(e) => setPunishment(e.target.value)}
            disabled={disabled}
            maxLength={140}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Check-ins per week</Label>
            <Stepper value={req} min={1} max={14} onChange={setReq} disabled={disabled} />
          </div>
          <div>
            <Label>Cooldown (hours)</Label>
            <Stepper value={cooldown} min={1} max={24} onChange={setCooldown} disabled={disabled} />
          </div>
        </div>
        <label className="block">
          <Label hint="weeks run Mon → Sun here">Timezone</Label>
          <input className={field} value={tz} onChange={(e) => setTz(e.target.value)} disabled={disabled} placeholder="America/New_York" list="tz-list" />
          <datalist id="tz-list">
            {["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Australia/Sydney"].map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
          {!tzOk && <span className="mt-1 block text-xs text-problem">Not a valid IANA timezone.</span>}
        </label>
        <p className="text-[11px] leading-relaxed text-muted">
          Changes apply to the current week. Finished weeks keep the rules and punishment they were played under.
        </p>
      </div>
      {!disabled && (
        <SaveRow
          state={state}
          disabled={!tzOk || !punishment.trim()}
          onSave={() => run(() => updateSettings({ weeklyRequirement: req, cooldownHours: cooldown, punishment: punishment.trim(), timezone: tz }))}
        />
      )}
    </section>
  );
}

function AppSection({ settings, disabled }: { settings: Settings; disabled: boolean }) {
  const { updateSettings } = useGame();
  const [title, setTitle] = useState(settings.appTitle);
  const [subtitle, setSubtitle] = useState(settings.appSubtitle);
  const { state, run } = useSaver();
  return (
    <section className="mt-10">
      <SectionTitle>App</SectionTitle>
      <div className="space-y-4">
        <label className="block">
          <Label>Title</Label>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} disabled={disabled} maxLength={40} />
        </label>
        <label className="block">
          <Label>Subtitle</Label>
          <input className={field} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} disabled={disabled} maxLength={80} />
        </label>
      </div>
      {!disabled && (
        <SaveRow state={state} disabled={!title.trim()} onSave={() => run(() => updateSettings({ appTitle: title.trim(), appSubtitle: subtitle.trim() }))} />
      )}
    </section>
  );
}

function Stepper({ value, min, max, onChange, disabled }: { value: number; min: number; max: number; onChange: (n: number) => void; disabled?: boolean }) {
  const btn = "grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-lg font-bold disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={disabled || value <= min} aria-label="Decrease">
        −
      </button>
      <span className="font-display tabular flex-1 text-center text-2xl font-black">{value}</span>
      <button className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled || value >= max} aria-label="Increase">
        +
      </button>
    </div>
  );
}
