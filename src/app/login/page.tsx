"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { getBackend } from "@/lib/backend";
import { resetDemo } from "@/lib/backend/demo";
import { DEFAULT_SETTINGS } from "@/lib/config";
import { loginNameProblem } from "@/lib/login-name";
import type { Player } from "@/lib/types";

export default function LoginPage() {
  const backend = getBackend();
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <p className="eyebrow">Members only</p>
        <h1 className="font-display mt-3 text-[52px] leading-[0.88] font-black">
          The Great
          <br />
          Check In
        </h1>
        <p className="mt-3 text-sm text-muted">{DEFAULT_SETTINGS.appSubtitle}</p>
      </motion.div>
      <div className="mt-10">{backend.mode === "demo" ? <DemoLogin /> : <NameLogin />}</div>
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
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface/70 px-4 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
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

  const field = "w-full rounded-xl border border-line bg-surface px-4 py-3.5 text-ink placeholder:text-muted/70 outline-none focus:border-volt/60";

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
      <button disabled={busy} className="mt-2 w-full rounded-2xl bg-volt py-4 font-display text-lg font-black tracking-wide text-volt-ink disabled:opacity-60">
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
        <p className="pt-2 text-center text-[11px] text-muted">Forgot your password? Ask the admin to reset it in Supabase.</p>
      )}
    </form>
  );
}
