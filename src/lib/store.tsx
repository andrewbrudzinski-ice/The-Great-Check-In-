"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getBackend, type Session } from "./backend";
import { forgetClub, savedClub, saveClub } from "./cache";
import type { ChallengeInput, GymInput, ProgramInput } from "./backend/types";
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
  /** False while the screen shows this phone's saved copy and fresh data is on its way. */
  fresh: boolean;
  /** Set when a refresh failed but there's data on screen to keep showing. */
  refreshError: string | null;
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
  addGym: (input: GymInput) => Promise<void>;
  approveGym: (id: string) => Promise<void>;
  updateGym: (id: string, input: GymInput) => Promise<void>;
  archiveGym: (id: string) => Promise<void>;
  setPlayerRequirement: (id: string, requirement: number | null) => Promise<void>;
  setPlayerPaused: (id: string, paused: boolean) => Promise<void>;
  setPlayerAdmin: (id: string, admin: boolean) => Promise<void>;
  adminCheckIn: (input: { userId: string; gymId: string; at: string; note: string }) => Promise<void>;
  adminRemoveCheckIn: (id: string) => Promise<void>;
  logChallenge: (challengeId: string, amount: number) => Promise<void>;
  deleteChallengeLog: (id: string) => Promise<void>;
  saveChallenge: (input: ChallengeInput) => Promise<void>;
  archiveChallenge: (id: string) => Promise<void>;
  startProgram: (input: ProgramInput) => Promise<void>;
  sendMessage: (body: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  toggleProgramTask: (programId: string, day: string, taskId: string, done: boolean) => Promise<void>;
  endProgram: (programId: string, status: "completed" | "failed" | "quit") => Promise<void>;
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
  const [fresh, setFresh] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const loadSeq = useRef(0);
  // Who the data on screen belongs to, and whether there is any.
  const user = useRef<Session | null>(null);
  const hasData = useRef(false);
  // Keep a copy on the phone for an instant start (real club only; the demo is instant anyway).
  const keepCopy = backend.mode === "supabase";

  const load = useCallback(
    async (finalize: boolean) => {
      const seq = ++loadSeq.current;
      try {
        // Close out finished weeks alongside the fetch instead of before it. It almost never has
        // anything to do; when it does (first open after a week ends), fetch again to get the results.
        const [closed, first] = await Promise.all([
          finalize ? backend.finalizeWeeks().catch(() => 0) : 0,
          backend.load(),
        ]);
        const d = closed > 0 ? await backend.load() : first;
        if (seq !== loadSeq.current) return;
        setData(d);
        hasData.current = true;
        setError(null);
        setRefreshError(null);
        setFresh(true);
        setStatus("ready");
        if (keepCopy && user.current) saveClub(user.current.userId, user.current.email, d);
      } catch (e) {
        if (seq !== loadSeq.current) return;
        const message = e instanceof Error ? e.message : "Couldn't load the club.";
        // With something on screen, keep showing it and say the refresh failed.
        if (hasData.current) setRefreshError(message);
        else {
          setError(message);
          setStatus("error");
        }
      }
    },
    [backend, keepCopy],
  );

  // Auth bootstrap
  useEffect(() => {
    let alive = true;
    let current: string | null | undefined; // undefined = not resolved yet
    // Draw the club from the phone's saved copy straight away; the session check
    // (which may need the network to renew a login) and fresh data follow. Only
    // the copy of whoever is logged in on this phone, never anyone else's.
    const stored = keepCopy ? backend.storedUserId() : null;
    const saved = stored ? savedClub(stored) : null;
    if (saved) {
      user.current = { userId: saved.userId, email: saved.email };
      hasData.current = true;
      setSession(user.current);
      setData(saved.data);
      setStatus("ready");
    }
    const apply = (s: Session | null) => {
      if (!alive || current === (s?.userId ?? null)) return;
      current = s?.userId ?? null;
      loadSeq.current++; // drop any load still running for someone else
      user.current = s;
      setSession(s);
      setFresh(false);
      setRefreshError(null);
      if (s) {
        const copy = saved?.userId === s.userId ? saved : keepCopy ? savedClub(s.userId) : null;
        if (copy) {
          hasData.current = true;
          setData(copy.data);
          setStatus("ready");
        } else {
          hasData.current = false;
          setData(null);
          setStatus("loading");
        }
        load(true);
      } else {
        hasData.current = false;
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
  }, [backend, load, keepCopy]);

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

  // Run a backend write, then reload so every screen sees it.
  const write = useCallback(
    <A extends unknown[]>(fn: (...args: A) => Promise<unknown>) =>
      async (...args: A) => {
        await fn(...args);
        await load(false);
      },
    [load],
  );
  const gymActions = useMemo(
    () => ({
      addGym: write((i: GymInput) => backend.addGym(i)),
      approveGym: write((id: string) => backend.approveGym(id)),
      updateGym: write((id: string, i: GymInput) => backend.updateGym(id, i)),
      archiveGym: write((id: string) => backend.archiveGym(id)),
      setPlayerRequirement: write((id: string, r: number | null) => backend.setPlayerRequirement(id, r)),
      setPlayerPaused: write((id: string, p: boolean) => backend.setPlayerPaused(id, p)),
      setPlayerAdmin: write((id: string, a: boolean) => backend.setPlayerAdmin(id, a)),
      adminCheckIn: write((i: { userId: string; gymId: string; at: string; note: string }) => backend.adminCheckIn(i)),
      adminRemoveCheckIn: write((id: string) => backend.adminRemoveCheckIn(id)),
      logChallenge: write((id: string, amount: number) => backend.logChallenge(id, amount)),
      deleteChallengeLog: write((id: string) => backend.deleteChallengeLog(id)),
      saveChallenge: write((i: ChallengeInput) => backend.saveChallenge(i)),
      archiveChallenge: write((id: string) => backend.archiveChallenge(id)),
      startProgram: write((i: ProgramInput) => backend.startProgram(i)),
      // Optimistic: your message shows instantly; the reload swaps in the real one.
      sendMessage: async (body: string) => {
        const temp = { id: `pending-${Date.now()}`, userId: session?.userId ?? "", body: body.trim(), deleted: false, createdAt: new Date().toISOString() };
        setData((d) => (d ? { ...d, messages: [...d.messages, temp] } : d));
        try {
          await backend.sendMessage(body);
        } finally {
          await load(false);
        }
      },
      deleteMessage: write((id: string) => backend.deleteMessage(id)),
      toggleReaction: write((id: string, emoji: string) => backend.toggleReaction(id, emoji)),
      // Optimistic: tick shows instantly, rolls back (via reload) if the save fails.
      toggleProgramTask: async (id: string, day: string, task: string, done: boolean) => {
        setData((d) => {
          if (!d) return d;
          const rest = d.programDays.filter((x) => !(x.programId === id && x.day === day));
          const cur = d.programDays.find((x) => x.programId === id && x.day === day)?.done ?? [];
          const next = done ? [...new Set([...cur, task])] : cur.filter((t) => t !== task);
          return { ...d, programDays: [...rest, { programId: id, day, done: next }] };
        });
        try {
          await backend.toggleProgramTask(id, day, task, done);
        } finally {
          await load(false);
        }
      },
      endProgram: write((id: string, status: "completed" | "failed" | "quit") => backend.endProgram(id, status)),
    }),
    [backend, write, load, session?.userId],
  );

  const updatePlayer = useCallback<Ctx["updatePlayer"]>(
    async (id, patch) => {
      await backend.updatePlayer(id, patch);
      await load(false);
    },
    [backend, load],
  );

  const signOut = useCallback(async () => {
    forgetClub(); // nothing of the club stays on the phone once you sign out
    await backend.signOut();
  }, [backend]);

  const value: Ctx = {
    status,
    error,
    fresh,
    refreshError,
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
    ...gymActions,
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
