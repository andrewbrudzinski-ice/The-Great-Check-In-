// Local demo backend: used automatically when no Supabase credentials are
// configured. Data lives in localStorage and is seeded with a few weeks of
// fake history so every screen has something to show. Not secure — it's a
// preview, and it says so in the UI.
import { DEFAULT_SETTINGS, PLAYER_COLORS } from "../config";
import { distanceM } from "../geo";
import { matchGym } from "../gyms";
import { PRESETS } from "../programs";
import type { AppData, Challenge, ChallengeLog, Program, ProgramDay, CheckIn, CheckInResult, Gym, Player, Punishment, Settings, WeekResult } from "../types";
import { addDays, localDate, midnightIn, weekKey, weekStartOf } from "../week";
import type { Backend, GymInput, Session } from "./types";

const KEY = "tgci-demo-v9";
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
  const settings: Settings = { ...DEFAULT_SETTINGS, timezone: tz };
  const now = new Date();
  const thisWeek = weekKey(now, tz);
  const weeks = 9;
  const firstWeek = addDays(thisWeek, -7 * weeks);
  const created = midnightIn(firstWeek, tz).toISOString();

  const players: Player[] = [
    { id: "p-andrew", name: "Andrew", avatar: "🦍", color: PLAYER_COLORS[0], isAdmin: true, createdAt: created, weeklyRequirement: null },
    { id: "p-mike", name: "Mike", avatar: "🦈", color: PLAYER_COLORS[1], isAdmin: false, createdAt: created, weeklyRequirement: null },
    { id: "p-john", name: "John", avatar: "🐻", color: PLAYER_COLORS[2], isAdmin: false, createdAt: created, weeklyRequirement: null },
  ];
  const gym = (id: string, name: string, latitude: number, longitude: number, radiusM: number, createdBy: string, status: Gym["status"] = "approved"): Gym => ({
    id, name, latitude, longitude, radiusM, status, createdBy,
    approvedBy: status === "approved" ? "p-andrew" : null, archived: false, createdAt: created,
  });
  const gyms: Gym[] = [
    gym("g-iron", "Demo Iron Club", 40.7359, -73.9911, 150, "p-andrew"),
    gym("g-midtown", "Midtown Fitness (demo)", 40.7505, -73.9934, 120, "p-mike"),
    gym("g-garage", "John's “Garage Gym”", 40.7295, -73.9965, 100, "p-john", "pending"),
  ];
  // Mike splits time between two gyms; everyone else lifts at Iron Club.
  const gymFor = (userId: string) => (userId === "p-mike" && r() < 0.45 ? gyms[1] : gyms[0]);

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
    const g = gymFor(userId);
    const jitter = () => (r() - 0.5) * 0.0007;
    const lat = g.latitude + jitter();
    const lng = g.longitude + jitter();
    checkIns.push({
      id: uid(r),
      userId,
      latitude: lat,
      longitude: lng,
      accuracy: 8 + Math.round(r() * 20),
      distanceM: Math.round(distanceM(lat, lng, g.latitude, g.longitude)),
      radiusM: g.radiusM,
      gymId: g.id,
      gymName: g.name,
      manual: false,
      addedBy: null,
      note: null,
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
  // Daily pushups for the last two weeks: Andrew never misses, Mike mostly, John… tries.
  const pushups: Challenge = {
    id: "c-pushups", name: "Pushups", emoji: "💪", dailyTarget: 100, unit: "reps",
    archived: false, createdBy: "p-andrew", createdAt: midnightIn(addDays(today, -14), tz).toISOString(),
  };
  const challengeLogs: ChallengeLog[] = [];
  const hitRate: Record<string, number> = { "p-andrew": 1, "p-mike": 0.8, "p-john": 0.45 };
  for (let back = 14; back >= 0; back--) {
    const day = addDays(today, -back);
    for (const p of players) {
      // today: still in progress for everyone
      let total = back === 0 ? [50, 70, 20][players.indexOf(p)] : r() < hitRate[p.id] ? 100 + Math.floor(r() * 3) * 10 : 40 + Math.floor(r() * 5) * 10;
      let hour = 8;
      while (total > 0) {
        const set = Math.min(total, [20, 25, 30, 50][Math.floor(r() * 4)]);
        const at = new Date(midnightIn(day, tz).getTime() + hour * 3600000);
        if (at < now) challengeLogs.push({ id: uid(r), challengeId: pushups.id, userId: p.id, amount: set, target: 100, day, loggedAt: at.toISOString() });
        total -= set;
        hour += 2;
      }
    }
  }
  // 75 Hard / Soft runs: Andrew on Day 23, Mike on Soft with a couple of misses,
  // John failed his first Hard attempt on Day 6 and is on attempt #2.
  const [hard, soft] = PRESETS;
  const programs: Program[] = [];
  const programDays: ProgramDay[] = [];
  const addRun = (
    id: string, userId: string, preset: typeof hard, startBack: number, attempt: number,
    status: Program["status"], dayDone: (i: number, ids: string[]) => string[], length = 75,
  ) => {
    const startDate = addDays(today, -startBack);
    programs.push({
      id, userId, name: `${length} ${preset.title}`, strict: preset.strict, lengthDays: length, tasks: preset.tasks,
      startDate, status, attempt, createdAt: midnightIn(startDate, tz).toISOString(),
      endedAt: status === "active" ? null : now.toISOString(),
    });
    const ids = preset.tasks.map((t) => t.id);
    for (let i = 0; i <= startBack; i++) {
      const done = dayDone(i, ids);
      if (done.length) programDays.push({ programId: id, day: addDays(startDate, i), done });
    }
  };
  addRun("r-andrew", "p-andrew", hard, 22, 1, "active", (i, ids) => (i === 22 ? ids.slice(0, 3) : ids));
  addRun("r-mike", "p-mike", soft, 9, 1, "active", (i, ids) => (i === 3 || i === 7 ? ids.slice(0, 2) : i === 9 ? [] : ids));
  addRun("r-john-1", "p-john", hard, 15, 1, "failed", (i, ids) => (i < 5 ? ids : i === 5 ? ids.slice(0, 4) : []));
  addRun("r-john-2", "p-john", hard, 2, 2, "active", (i, ids) => (i === 2 ? ids.slice(0, 1) : ids));

  const db: DemoDB = { players, checkIns, results: [], punishments: [], gyms, challenges: [pushups], challengeLogs, programs, programDays, settings };
  freeze(db, now);
  // Older debts were paid off; the most recent two are still owed.
  const payers = ["p-mike", "p-andrew", "p-john"];
  db.punishments.slice(0, -2).forEach((p, i) => {
    p.status = "done";
    p.completedBy = payers[i % payers.length];
    p.completedAt = new Date(midnightIn(addDays(p.weekStart, 9 + (i % 3)), tz).getTime() + (7 + 4 * (i % 3)) * 3600000).toISOString();
  });
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
      const requirement = p.weeklyRequirement ?? db.settings.weeklyRequirement;
      const completed = count >= requirement;
      const res: WeekResult = {
        weekStart: wk,
        userId: p.id,
        count,
        requirement,
        completed,
        punishment: completed ? null : db.settings.punishment,
      };
      db.results.push(res);
      changed = true;
    }
    // Anyone short → the whole group owes the punishment.
    if (db.results.some((r) => r.weekStart === wk && !r.completed)) {
      const p: Punishment = { weekStart: wk, text: db.settings.punishment, status: "owed", completedAt: null, completedBy: null };
      db.punishments.push(p);
    }
  }
  return changed;
}

/** Re-count a frozen week after a manual add/remove (mirrors app_private.refreeze_week). */
function refreeze(db: DemoDB, wk: string) {
  const tz = db.settings.timezone;
  const rows = db.results.filter((r) => r.weekStart === wk);
  if (!rows.length) return; // live week, nothing frozen
  for (const r of rows) {
    r.count = db.checkIns.filter((c) => c.userId === r.userId && weekKey(c.checkedInAt, tz) === wk).length;
    r.completed = r.count >= r.requirement;
    r.punishment = r.completed ? null : (r.punishment ?? db.settings.punishment);
  }
  const failed = rows.some((r) => !r.completed);
  const debt = db.punishments.find((p) => p.weekStart === wk);
  if (failed && !debt) {
    db.punishments.push({ weekStart: wk, text: db.settings.punishment, status: "owed", completedAt: null, completedBy: null });
  } else if (!failed && debt?.status === "owed") {
    db.punishments = db.punishments.filter((p) => p !== debt);
  }
}

function read(): DemoDB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { punishments: [], gyms: [], challenges: [], challengeLogs: [], programs: [], programDays: [], ...JSON.parse(raw) };
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
      if (accuracy != null && accuracy > 1000) return { ok: false, code: "low_accuracy", accuracy: Math.round(accuracy) };
      const m = matchGym(db.gyms, latitude, longitude);
      if (m.kind === "none") return { ok: false, code: "no_gym" };
      if (m.kind === "pending") return { ok: false, code: "gym_pending", gymName: m.gym.name };
      if (m.kind === "too_far")
        return { ok: false, code: "too_far", distance: Math.round(m.distance), radius: m.gym.radiusM, gymName: m.gym.name };
      const d = m.distance;
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
        radiusM: m.gym.radiusM,
        gymId: m.gym.id,
        gymName: m.gym.name,
        manual: false,
        addedBy: null,
        note: null,
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
    async addGym(input: GymInput) {
      const session = currentSession();
      if (!session) throw new Error("Sign in first.");
      const db = read();
      const admin = db.players.find((p) => p.id === session.userId)?.isAdmin ?? false;
      const g: Gym = {
        id: crypto.randomUUID?.() ?? String(Date.now()),
        name: input.name.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        radiusM: input.radiusM,
        status: admin ? "approved" : "pending",
        createdBy: session.userId,
        approvedBy: admin ? session.userId : null,
        archived: false,
        createdAt: new Date().toISOString(),
      };
      db.gyms.push(g);
      write(db);
      return g;
    },
    async approveGym(id) {
      const session = currentSession();
      const db = read();
      const g = db.gyms.find((x) => x.id === id && !x.archived);
      if (!session || !g) throw new Error("That gym doesn't exist anymore.");
      if (g.createdBy === session.userId) throw new Error("Someone else has to approve a gym you added.");
      g.status = "approved";
      g.approvedBy = session.userId;
      write(db);
    },
    async updateGym(id, input) {
      const session = currentSession();
      const db = read();
      const g = db.gyms.find((x) => x.id === id && !x.archived);
      if (!session || !g) throw new Error("That gym doesn't exist anymore.");
      const admin = db.players.find((p) => p.id === session.userId)?.isAdmin;
      if (!admin && !(g.createdBy === session.userId && g.status === "pending"))
        throw new Error("Only the admin (or whoever added a still-pending gym) can do that.");
      Object.assign(g, { name: input.name.trim(), latitude: input.latitude, longitude: input.longitude, radiusM: input.radiusM });
      write(db);
    },
    async archiveGym(id) {
      const session = currentSession();
      const db = read();
      const g = db.gyms.find((x) => x.id === id && !x.archived);
      if (!session || !g) throw new Error("That gym doesn't exist anymore.");
      const admin = db.players.find((p) => p.id === session.userId)?.isAdmin;
      if (!admin && g.createdBy !== session.userId) throw new Error("Only the admin or whoever added it can remove a gym.");
      g.archived = true;
      write(db);
    },
    async setPlayerRequirement(id, requirement) {
      const session = currentSession();
      const db = read();
      if (!session || !db.players.find((p) => p.id === session.userId)?.isAdmin) throw new Error("Only the admin can change someone's goal.");
      if (requirement != null && (requirement < 1 || requirement > 14)) throw new Error("Pick a goal between 1 and 14.");
      const p = db.players.find((x) => x.id === id);
      if (!p) throw new Error("That player doesn't exist.");
      p.weeklyRequirement = requirement;
      write(db);
    },
    async adminCheckIn({ userId, gymId, at, note }) {
      const session = currentSession();
      const db = read();
      if (!session || !db.players.find((p) => p.id === session.userId)?.isAdmin)
        throw new Error("Only the admin can add check-ins for someone else.");
      const g = db.gyms.find((x) => x.id === gymId && x.status === "approved" && !x.archived);
      if (!g) throw new Error("Pick an approved gym.");
      const t = new Date(at).getTime();
      if (t > Date.now() + 5 * 60000) throw new Error("That time is in the future.");
      if (t < Date.now() - 14 * 86400000) throw new Error("You can only go back 14 days.");
      const window = db.settings.cooldownHours * 3600000;
      if (db.checkIns.some((c) => c.userId === userId && Math.abs(new Date(c.checkedInAt).getTime() - t) < window))
        throw new Error("They already have a check-in within the cooldown window of that time.");
      db.checkIns.push({
        id: crypto.randomUUID?.() ?? String(Date.now()),
        userId,
        latitude: g.latitude,
        longitude: g.longitude,
        accuracy: null,
        distanceM: null,
        radiusM: g.radiusM,
        gymId: g.id,
        gymName: g.name,
        manual: true,
        addedBy: session.userId,
        note: note.trim() || null,
        checkedInAt: new Date(t).toISOString(),
      });
      db.checkIns.sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt));
      refreeze(db, weekKey(new Date(t), db.settings.timezone));
      write(db);
    },
    async adminRemoveCheckIn(id) {
      const session = currentSession();
      const db = read();
      if (!session || !db.players.find((p) => p.id === session.userId)?.isAdmin) throw new Error("Only the admin can do that.");
      const c = db.checkIns.find((x) => x.id === id && x.manual);
      if (!c) throw new Error("That check-in is already gone (only manual ones can be removed).");
      db.checkIns = db.checkIns.filter((x) => x !== c);
      refreeze(db, weekKey(c.checkedInAt, db.settings.timezone));
      write(db);
    },
    async logChallenge(challengeId, amount) {
      const session = currentSession();
      if (!session) throw new Error("Sign in first.");
      const db = read();
      const c = db.challenges.find((x) => x.id === challengeId && !x.archived);
      if (!c) throw new Error("That challenge is gone.");
      if (!Number.isFinite(amount) || amount < 1 || amount > 100000) throw new Error("Enter a number above zero.");
      db.challengeLogs.push({
        id: crypto.randomUUID?.() ?? String(Date.now()),
        challengeId,
        userId: session.userId,
        amount: Math.round(amount),
        target: c.dailyTarget,
        day: localDate(new Date(), db.settings.timezone),
        loggedAt: new Date().toISOString(),
      });
      write(db);
    },
    async deleteChallengeLog(id) {
      const session = currentSession();
      const db = read();
      const yesterday = addDays(localDate(new Date(), db.settings.timezone), -1);
      const l = db.challengeLogs.find((x) => x.id === id && x.userId === session?.userId && x.day >= yesterday);
      if (!l) throw new Error("That set is too old to undo.");
      db.challengeLogs = db.challengeLogs.filter((x) => x !== l);
      write(db);
    },
    async saveChallenge({ id, name, emoji, dailyTarget, unit }) {
      const session = currentSession();
      if (!session) throw new Error("Sign in first.");
      const db = read();
      if (id) {
        const c = db.challenges.find((x) => x.id === id && !x.archived);
        if (!c) throw new Error("That challenge is gone.");
        Object.assign(c, { name: name.trim(), emoji: emoji.trim() || c.emoji, dailyTarget, unit: unit.trim() || c.unit });
      } else {
        if (db.challenges.filter((c) => !c.archived).length >= 10) throw new Error("That's a lot of challenges. Retire one first.");
        db.challenges.push({
          id: crypto.randomUUID?.() ?? String(Date.now()),
          name: name.trim(),
          emoji: emoji.trim() || "💪",
          dailyTarget,
          unit: unit.trim() || "reps",
          archived: false,
          createdBy: session.userId,
          createdAt: new Date().toISOString(),
        });
      }
      write(db);
    },
    async startProgram({ name, strict, lengthDays, tasks, startTomorrow }) {
      const session = currentSession();
      if (!session) throw new Error("Sign in first.");
      const db = read();
      if (!tasks.length || tasks.length > 10) throw new Error("Add between 1 and 10 daily tasks.");
      if (lengthDays < 7 || lengthDays > 365) throw new Error("Pick a length between 7 and 365 days.");
      if (db.programs.filter((p) => p.userId === session.userId && p.status === "active").length >= 3)
        throw new Error("You already have 3 runs going. Finish or quit one first.");
      const prev = db.programs.filter((p) => p.userId === session.userId && p.name.toLowerCase() === name.trim().toLowerCase()).length;
      const today = localDate(new Date(), db.settings.timezone);
      db.programs.push({
        id: crypto.randomUUID?.() ?? String(Date.now()),
        userId: session.userId,
        name: name.trim(),
        strict,
        lengthDays,
        tasks,
        startDate: startTomorrow ? addDays(today, 1) : today,
        status: "active",
        attempt: prev + 1,
        createdAt: new Date().toISOString(),
        endedAt: null,
      });
      write(db);
    },
    async toggleProgramTask(programId, day, taskId, done) {
      const session = currentSession();
      const db = read();
      const p = db.programs.find((x) => x.id === programId && x.userId === session?.userId && x.status === "active");
      if (!p) throw new Error("That run isn't active anymore.");
      const today = localDate(new Date(), db.settings.timezone);
      if (day > today || day < addDays(today, -1)) throw new Error("That day is locked. You can only tick today or yesterday.");
      if (day < p.startDate || day > addDays(p.startDate, p.lengthDays - 1)) throw new Error("That day isn't part of this run.");
      let row = db.programDays.find((d) => d.programId === programId && d.day === day);
      if (!row) db.programDays.push((row = { programId, day, done: [] }));
      row.done = done ? [...new Set([...row.done, taskId])] : row.done.filter((t) => t !== taskId);
      write(db);
    },
    async endProgram(programId, status) {
      const session = currentSession();
      const db = read();
      const p = db.programs.find((x) => x.id === programId && x.userId === session?.userId && x.status === "active");
      if (!p) throw new Error("That run isn't active anymore.");
      p.status = status;
      p.endedAt = new Date().toISOString();
      write(db);
    },
    async archiveChallenge(id) {
      const db = read();
      const c = db.challenges.find((x) => x.id === id && !x.archived);
      if (!c) throw new Error("That challenge is gone.");
      c.archived = true;
      write(db);
    },
    async setPunishmentDone(weekStart, done) {
      const session = currentSession();
      if (!session) throw new Error("Sign in first.");
      const db = read();
      freeze(db, new Date());
      const p = db.punishments.find((x) => x.weekStart === weekStart);
      if (!p) throw new Error("Couldn't find that punishment.");
      p.status = done ? "done" : "owed";
      p.completedAt = done ? new Date().toISOString() : null;
      p.completedBy = done ? session.userId : null;
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
