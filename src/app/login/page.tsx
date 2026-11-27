"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Mark } from "@/components/Mark";
import { getBackend } from "@/lib/backend";
import { resetDemo } from "@/lib/backend/demo";
import { DEFAULT_SETTINGS } from "@/lib/config";
import { loginNameProblem } from "@/lib/login-name";
import type { Player } from "@/lib/types";

export default function LoginPage() {
  const backend = getBackend();
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div aria-hidden className="grid-texture pointer-events-none absolute inset-x-0 top-0 h-[70%]" />
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(200,255,61,0.13),transparent)]" />
      <div className="relative mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Mark size={52} draw className="mb-7" />
          <p className="eyebrow !text-volt">Members only</p>
          <h1 className="font-big mt-3 text-[clamp(76px,26vw,104px)] leading-[0.82] uppercase">
            The Great
            <br />
            Check In
          </h1>
          <p className="mt-4 text-[15px] text-ink-2">{DEFAULT_SETTINGS.appSubtitle}</p>
        </motion.div>
        <div className="mt-10">{backend.mode === "demo" ? <DemoLogin /> : <NameLogin />}</div>
      </div>
    </div>
  );
}

function DemoLogin() {
  const [players, setPlayers] = useState<Player[]>([]);
  useEffect(() => {
    getBackend().load().then((d) => setPlayers(d.players));
  }, []);
  return (
    <div>
      <p className="mb-4 text-sm text-ink-2">Who are you?</p>
      <div className="space-y-2">
        {players.map((p, i) => (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
            onClick={() => getBackend().signIn(p.id, "")}
            className="pressable flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-surface-2"
          >
            <Avatar player={p} size={40} />
            <span className="font-display text-lg font-extrabold">{p.name}</span>
          </motion.button>
        ))}
      </div>
      <p className="mt-8 text-xs leading-relaxed text-muted">
        <b className="text-ink-2">Demo mode.</b> No backend is configured, so data lives in this browser and you can play as
        anyone. Connect Supabase (see README) for real accounts, where each player can only check in as themselves.
      </p>
      <button
        onClick={() => {
          resetDemo();
          location.reload();
        }}
        className="mt-3 text-xs font-semibold text-muted underline underline-offset-4 hover:text-ink"
      >
        Reset demo data
      </button>
    </div>
  );
}

function NameLogin() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "up") {
      const problem = loginNameProblem(name);
      if (problem) return setError(problem);
    }
    setBusy(true);
    try {
      if (mode === "in") await getBackend().signIn(name, password);
      else await getBackend().signUp({ name, password, inviteCode: invite.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const field = "h-[52px] w-full rounded-2xl border border-line bg-surface px-4 text-ink placeholder:text-muted/80 outline-none transition-colors focus:border-volt/60";

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        className={field}
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={40}
        autoComplete="username"
        autoCapitalize="words"
        autoCorrect="off"
        spellCheck={false}
      />
      <input
        className={field}
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        autoComplete={mode === "in" ? "current-password" : "new-password"}
      />
      {mode === "up" && (
        <>
          <input className={field} placeholder="Invite code (if your club uses one)" value={invite} onChange={(e) => setInvite(e.target.value)} autoComplete="off" />
          <p className="px-1 text-xs text-muted">
            This name is how you&apos;ll sign in, so pick one you&apos;ll remember. Capitals and spaces don&apos;t matter. Password: 6+ characters.
          </p>
        </>
      )}
      {error && (
        <p className="text-sm text-problem">
          {error}
          {mode === "in" && /wrong name/i.test(error) && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => {
                  setMode("up");
                  setError(null);
                }}
                className="font-semibold text-ink underline underline-offset-2"
              >
                No account yet? Create one.
              </button>
            </>
          )}
        </p>
      )}
      <button
        disabled={busy}
        className="pressable mt-2 h-14 w-full rounded-2xl bg-[linear-gradient(180deg,#d8ff6e_0%,var(--color-volt)_55%,#b9f02c_100%)] font-display text-lg font-extrabold tracking-[0.02em] text-volt-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-3px_0_rgba(0,0,0,0.14),0_16px_36px_-16px_rgba(200,255,61,0.5)] disabled:opacity-60"
      >
        {busy ? "…" : mode === "in" ? "Sign in" : "Join the club"}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === "in" ? "up" : "in");
          setError(null);
        }}
        className="w-full py-2 text-sm text-muted hover:text-ink"
      >
        {mode === "in" ? "New here? Create your account" : "Already a member? Sign in"}
      </button>
      {mode === "in" && (
        <p className="pt-2 text-center text-[11px] text-muted">Forgot your password? Ask the club owner to reset it in Supabase.</p>
      )}
    </form>
  );
}
