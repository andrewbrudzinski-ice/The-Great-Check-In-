export type Player = {
  id: string;
  name: string;
  /** An emoji, or an http(s) image URL. */
  avatar: string;
  color: string;
  isAdmin: boolean;
  createdAt: string;
};

export type CheckIn = {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  distanceM: number | null;
  /** Check-in radius in force when this was verified. */
  radiusM: number | null;
  /** The gym the server matched this check-in to. */
  gymId: string | null;
  gymName: string;
  /** Added by the admin for someone who forgot — no GPS behind it. */
  manual: boolean;
  addedBy: string | null;
  note: string | null;
  /** Server timestamp, ISO 8601. */
  checkedInAt: string;
};

export type Settings = {
  appTitle: string;
  appSubtitle: string;
  /** Default radius offered when adding a gym. */
  checkInRadius: number;
  weeklyRequirement: number;
  cooldownHours: number;
  punishment: string;
  timezone: string;
};

export type Gym = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  /** Pending gyms need another player's approval before check-ins count. */
  status: "pending" | "approved";
  createdBy: string | null;
  approvedBy: string | null;
  archived: boolean;
  createdAt: string;
};

/** A daily challenge, e.g. "Pushups · 100 reps a day". */
export type Challenge = {
  id: string;
  name: string;
  emoji: string;
  dailyTarget: number;
  unit: string;
  archived: boolean;
  createdBy: string | null;
  createdAt: string;
};

/** One logged set. `day` is the club-timezone date it counts for. */
export type ChallengeLog = {
  id: string;
  challengeId: string;
  userId: string;
  amount: number;
  /** The challenge's target when this was logged. */
  target: number;
  day: string; // YYYY-MM-DD
  loggedAt: string;
};

export type ProgramTask = { id: string; label: string; emoji: string };

/** One attempt at 75 Hard / 75 Soft / a shorter run. */
export type Program = {
  id: string;
  userId: string;
  name: string;
  /** Hard rules: a missed day means back to Day 1. */
  strict: boolean;
  lengthDays: number;
  tasks: ProgramTask[];
  startDate: string; // YYYY-MM-DD
  status: "active" | "completed" | "failed" | "quit";
  attempt: number;
  createdAt: string;
  endedAt: string | null;
};

export type ProgramDay = { programId: string; day: string; done: string[] };

/** A frozen result for one player in one finished week. */
export type WeekResult = {
  weekStart: string; // YYYY-MM-DD (Monday)
  userId: string;
  count: number;
  requirement: number;
  completed: boolean;
  punishment: string | null;
};

/** The group punishment owed for a week where anyone missed the goal. */
export type Punishment = {
  weekStart: string; // YYYY-MM-DD (Monday)
  text: string;
  status: "owed" | "done";
  completedAt: string | null;
  completedBy: string | null; // player id
};

export type AppData = {
  players: Player[];
  checkIns: CheckIn[];
  results: WeekResult[];
  punishments: Punishment[];
  gyms: Gym[];
  challenges: Challenge[];
  challengeLogs: ChallengeLog[];
  programs: Program[];
  programDays: ProgramDay[];
  settings: Settings;
};

export type CheckInResult =
  | { ok: true; checkIn: CheckIn }
  | { ok: false; code: "too_far"; distance: number; radius: number; gymName: string }
  | { ok: false; code: "gym_pending"; gymName: string }
  | { ok: false; code: "cooldown"; nextAllowedAt: string }
  | { ok: false; code: "low_accuracy"; accuracy: number }
  | { ok: false; code: "no_gym" | "not_authenticated" | "no_profile" | "invalid_location" }
  | { ok: false; code: "error"; message: string };
