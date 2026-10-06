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
  gymName: string;
  /** Server timestamp, ISO 8601. */
  checkedInAt: string;
};

export type Settings = {
  appTitle: string;
  appSubtitle: string;
  gymName: string;
  gymLatitude: number | null;
  gymLongitude: number | null;
  checkInRadius: number;
  weeklyRequirement: number;
  cooldownHours: number;
  punishment: string;
  timezone: string;
};

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
  settings: Settings;
};

export type CheckInResult =
  | { ok: true; checkIn: CheckIn }
  | { ok: false; code: "too_far"; distance: number; radius: number }
  | { ok: false; code: "cooldown"; nextAllowedAt: string }
  | { ok: false; code: "low_accuracy"; accuracy: number }
  | { ok: false; code: "no_gym" | "not_authenticated" | "no_profile" | "invalid_location" }
  | { ok: false; code: "error"; message: string };
