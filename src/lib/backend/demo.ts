// Local demo backend: used automatically when no Supabase credentials are
// configured. Data lives in localStorage and is seeded with a few weeks of
// fake history so every screen has something to show. Not secure — it's a
// preview, and it says so in the UI.
import { DEFAULT_SETTINGS, PLAYER_COLORS } from "../config";
import { distanceM } from "../geo";
import type { AppData, CheckIn, CheckInResult, Player, Settings, WeekResult } from "../types";
import { addDays, localDate, midnightIn, weekKey, weekStartOf } from "../week";
import type { Backend, Session } from "./types";

const KEY = "tgci-demo-v1";
const SESSION_KEY = "tgci-demo-session";

type DemoDB = AppData;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function uid(r: () => number) {
  return Array.from({ length: 4 }, () => Math.floor(r() * 0xffffffff).toString(16).padStart(8, "0")).join("-");
}

function browserTz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_SETTINGS.timezone;
  } catch {
    return DEFAULT_SETTINGS.timezone;
  }
}

function seed(): DemoDB {
  const r = rng(42);
  const tz = browserTz();
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    gymName: "Demo Iron Club",
    gymLatitude: 40.7359,
    gymLongitude: -73.9911,
    timezone: tz,
  };
  const now = new Date();
  const thisWeek = weekKey(now, tz);
  const weeks = 9;
  const firstWeek = addDays(thisWeek, -7 * weeks);
  const created = midnightIn(firstWeek, tz).toISOString();

  const players: Player[] = [
    { id: "p-andrew", name: "Andrew", avatar: "🦍", color: PLAYER_COLORS[0], isAdmin: true, createdAt: created },
    { id: "p-mike", name: "Mike", avatar: "🦈", color: PLAYER_COLORS[1], isAdmin: false, createdAt: created },
    { id: "p-john", name: "John", avatar: "🐻", color: PLAYER_COLORS[2], isAdmin: false, createdAt: created },
  ];
  // Finished-week counts, oldest → newest. John flunked last week.
  const plan: Record<string, number[]> = {
    "p-andrew": [5, 6, 5, 4, 5, 5, 6, 5, 5],
    "p-mike": [6, 5, 5, 5, 7, 5, 6, 6, 5],
    "p-john": [3, 5, 2, 5, 4, 5, 6, 5, 3],
  };

  const checkIns: CheckIn[] = [];
  const at = (date: string, hour: number, userId: string) => {
    const t = new Date(midnightIn(date, tz).getTime() + hour * 3600000 + Math.floor(r() * 50) * 60000);
    if (t >= now) return;
    const jitter = () => (r() - 0.5) * 0.0007;
    const lat = settings.gymLatitude! + jitter();
    const lng = settings.gymLongitude! + jitter();
    checkIns.push({
      id: uid(r),
      userId,
      latitude: lat,
      longitude: lng,
      accuracy: 8 + Math.round(r() * 20),
      distanceM: Math.round(distanceM(lat, lng, settings.gymLatitude!, settings.gymLongitude!)),
      gymName: settings.gymName,
      checkedInAt: t.toISOString(),
    });
  };

  for (let w = 0; w < weeks; w++) {
    const wk = addDays(firstWeek, w * 7);
    for (const p of players) {
      const n = plan[p.id][w];
      const days = [0, 1, 2, 3, 4, 5, 6].sort(() => r() - 0.5);
      for (let i = 0; i < n; i++) {
        // >7 means a double day: second session in the evening
        const day = days[i % 7];
        at(addDays(wk, day), i >= 7 ? 18 : 6 + Math.floor(r() * 12), p.id);
      }
    }
  }

  // Current week: whatever days have already happened.
  const today = localDate(now, tz);
  for (let d = thisWeek; d < today; d = addDays(d, 1)) {
    at(d, 7, "p-andrew");
    if (r() > 0.35) at(d, 17, "p-mike");
  }

  checkIns.sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt));
  const db: DemoDB = { players, checkIns, results: [], settings };
  freeze(db, now);
  return db;
}

/** Freeze finished weeks, mirroring public.finalize_past_weeks(). */
function freeze(db: DemoDB, now: Date) {
  const tz = db.settings.timezone;
  const cur = weekKey(now, tz);
  const first = db.players.map((p) => localDate(p.createdAt, tz)).sort()[0];
  if (!first) return false;
  let changed = false;
  for (let wk = weekStartOf(first); wk < cur; wk = addDays(wk, 7)) {
    if (db.results.some((r) => r.weekStart === wk)) continue;
    for (const p of db.players) {
      if (localDate(p.createdAt, tz) > wk) continue; // join week is a warm-up
      const count = db.checkIns.filter((c) => c.userId === p.id && weekKey(c.checkedInAt, tz) === wk).length;
      const completed = count >= db.settings.weeklyRequirement;
      const res: WeekResult = {
        weekStart: wk,
        userId: p.id,
        count,
        requirement: db.settings.weeklyRequirement,
        completed,
        punishment: completed ? null : db.settings.punishment,
      };
      db.results.push(res);
      changed = true;
    }
  }
  return changed;
}

function read(): DemoDB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to a fresh seed */
  }
  const db = seed();
  write(db);
  return db;
}

function write(db: DemoDB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* storage full or blocked — demo keeps working in memory for this load */
  }
}

export function resetDemo() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function createDemoBackend(): Backend {
  const listeners = new Set<(s: Session | null) => void>();
  const currentSession = (): Session | null => {
    try {
      const id = localStorage.getItem(SESSION_KEY);
      return id && read().players.some((p) => p.id === id) ? { userId: id } : null;
    } catch {
      return null;
    }
  };
  const emit = () => listeners.forEach((l) => l(currentSession()));

  return {
    mode: "demo",
    async getSession() {
      return currentSession();
    },
    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    /** Demo: `email` is the player id to play as. */
    async signIn(playerId) {
      localStorage.setItem(SESSION_KEY, playerId);
      emit();
    },
    async signUp() {
      throw new Error("Sign-up needs Supabase. In demo mode, pick a player.");
    },
    async signOut() {
      localStorage.removeItem(SESSION_KEY);
      emit();
    },
    async finalizeWeeks() {
      const db = read();
      if (freeze(db, new Date())) write(db);
    },
    async load() {
      return structuredClone(read());
    },
    async checkIn({ latitude, longitude, accuracy }): Promise<CheckInResult> {
      await new Promise((r) => setTimeout(r, 450)); // feel like a network hop
      const session = currentSession();
      if (!session) return { ok: false, code: "not_authenticated" };
      const db = read();
      const s = db.settings;
      if (s.gymLatitude == null || s.gymLongitude == null) return { ok: false, code: "no_gym" };
      if (accuracy != null && accuracy > 1000) return { ok: false, code: "low_accuracy", accuracy: Math.round(accuracy) };
      const d = distanceM(latitude, longitude, s.gymLatitude, s.gymLongitude);
      if (d > s.checkInRadius) return { ok: false, code: "too_far", distance: Math.round(d), radius: s.checkInRadius };
      const last = db.checkIns.filter((c) => c.userId === session.userId).at(-1);
      const next = last ? new Date(last.checkedInAt).getTime() + s.cooldownHours * 3600000 : 0;
      if (next > Date.now()) return { ok: false, code: "cooldown", nextAllowedAt: new Date(next).toISOString() };
      const checkIn: CheckIn = {
        id: crypto.randomUUID?.() ?? String(Date.now()),
        userId: session.userId,
        latitude,
        longitude,
        accuracy,
        distanceM: Math.round(d * 10) / 10,
        gymName: s.gymName,
        checkedInAt: new Date().toISOString(),
      };
      db.checkIns.push(checkIn);
      write(db);
      return { ok: true, checkIn };
    },
    async updateSettings(patch) {
      const db = read();
      db.settings = { ...db.settings, ...patch };
      write(db);
    },
    async updatePlayer(id, patch) {
      const db = read();
      db.players = db.players.map((p) => (p.id === id ? { ...p, ...patch } : p));
      write(db);
    },
    subscribe(cb) {
      const onStorage = (e: StorageEvent) => e.key === KEY && cb();
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
  };
}
