"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getBackend, type Session } from "./backend";
import { computeGame, type GameState } from "./game";
import { getCurrentFix, LocationError } from "./geo";
import type { AppData, CheckInResult, Player, Settings } from "./types";

export type CheckInOutcome =
  | { kind: "result"; result: CheckInResult; fix: { latitude: number; longitude: number; accuracy: number } }
  | { kind: "location"; error: LocationError };

type Status = "loading" | "signedOut" | "ready" | "error";

type Ctx = {
  status: Status;
  error: string | null;
  mode: "supabase" | "demo";
  session: Session | null;
  data: AppData | null;
  game: GameState | null;
  me: Player | null;
  now: Date;
  refresh: () => Promise<void>;
  checkIn: (onStage?: (stage: "locating" | "verifying") => void) => Promise<CheckInOutcome>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  setPunishmentDone: (weekStart: string, done: boolean) => Promise<void>;
  updatePlayer: (id: string, patch: Partial<Pick<Player, "name" | "avatar" | "color">>) => Promise<void>;
  signOut: () => Promise<void>;
};

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const backend = getBackend();
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<AppData | null>(null);
  const [now, setNow] = useState(() => new Date());
  const loadSeq = useRef(0);

  const load = useCallback(
    async (finalize: boolean) => {
      const seq = ++loadSeq.current;
      try {
        if (finalize) await backend.finalizeWeeks();
        const d = await backend.load();
        if (seq !== loadSeq.current) return;
        setData(d);
        setError(null);
        setStatus("ready");
      } catch (e) {
        if (seq !== loadSeq.current) return;
        setError(e instanceof Error ? e.message : "Couldn't load the club.");
        setStatus("error");
      }
    },
    [backend],
  );

  // Auth bootstrap
  useEffect(() => {
    let alive = true;
    let current: string | null | undefined; // undefined = not resolved yet
    const apply = (s: Session | null) => {
      if (!alive || current === (s?.userId ?? null)) return;
      current = s?.userId ?? null;
      setSession(s);
      if (s) {
        setStatus("loading");
        load(true);
      } else {
        setData(null);
        setStatus("signedOut");
      }
    };
    backend.getSession().then(apply);
    const off = backend.onAuthChange(apply);
    return () => {
      alive = false;
      off();
    };
  }, [backend, load]);

  // Clock: drives countdowns and the Monday rollover.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Live updates + refresh when the app comes back to the foreground.
  useEffect(() => {
    if (!session) return;
    const off = backend.subscribe(() => load(false));
    const onVis = () => {
      if (document.visibilityState === "visible") {
        setNow(new Date());
        load(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      off();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [backend, session, load]);

  const game = useMemo(() => (data ? computeGame(data, now) : null), [data, now]);

  // New week started while the app was open → freeze last week.
  const lastWeek = useRef<string | null>(null);
  useEffect(() => {
    if (!game) return;
    if (lastWeek.current && lastWeek.current !== game.weekStart) load(true);
    lastWeek.current = game.weekStart;
  }, [game, load]);

  const me = useMemo(() => data?.players.find((p) => p.id === session?.userId) ?? null, [data, session]);

  const checkIn = useCallback<Ctx["checkIn"]>(
    async (onStage) => {
      onStage?.("locating");
      let fix;
      try {
        fix = await getCurrentFix();
      } catch (e) {
        return {
          kind: "location",
          error: e instanceof LocationError ? e : new LocationError("unavailable", "Location unavailable."),
        };
      }
      onStage?.("verifying");
      const result = await backend.checkIn(fix);
      if (result.ok) {
        setData((d) => (d ? { ...d, checkIns: [...d.checkIns, result.checkIn] } : d));
        setNow(new Date());
        load(false);
      }
      return { kind: "result", result, fix };
    },
    [backend, load],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      await backend.updateSettings(patch);
      await load(false);
    },
    [backend, load],
  );

  const setPunishmentDone = useCallback(
    async (weekStart: string, done: boolean) => {
      await backend.setPunishmentDone(weekStart, done);
      await load(false);
    },
    [backend, load],
  );

  const updatePlayer = useCallback<Ctx["updatePlayer"]>(
    async (id, patch) => {
      await backend.updatePlayer(id, patch);
      await load(false);
    },
    [backend, load],
  );

  const signOut = useCallback(async () => {
    await backend.signOut();
  }, [backend]);

  const value: Ctx = {
    status,
    error,
    mode: backend.mode,
    session,
    data,
    game,
    me,
    now,
    refresh: () => load(true),
    checkIn,
    updateSettings,
    setPunishmentDone,
    updatePlayer,
    signOut,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}

/** For screens that render only once data is loaded (inside AppShell). */
export function useGame() {
  const ctx = useApp();
  return ctx as Ctx & { data: AppData; game: GameState };
}
