import type { AppData, CheckInResult, Gym, Player, Settings } from "../types";

export type Session = { userId: string; email?: string };

/**
 * Everything the UI needs from a data source. Two implementations:
 * Supabase (production) and a localStorage demo used when no Supabase
 * credentials are configured.
 */
export interface Backend {
  mode: "supabase" | "demo";
  getSession(): Promise<Session | null>;
  onAuthChange(cb: (s: Session | null) => void): () => void;
  /** `name` is the player's sign-in name (or, for older accounts, an email). */
  signIn(name: string, password: string): Promise<void>;
  signUp(input: { name: string; password: string; inviteCode: string }): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  /** Freeze any finished weeks into weekly_results. Idempotent. */
  finalizeWeeks(): Promise<void>;
  load(): Promise<AppData>;
  checkIn(fix: { latitude: number; longitude: number; accuracy: number | null }): Promise<CheckInResult>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  /** Add a gym. Admin-added gyms are approved; others start pending. */
  addGym(input: GymInput): Promise<Gym>;
  /** Vouch for a gym someone else added. */
  approveGym(id: string): Promise<void>;
  updateGym(id: string, input: GymInput): Promise<void>;
  archiveGym(id: string): Promise<void>;
  /** Mark a week's group punishment done (or back to owed). */
  setPunishmentDone(weekStart: string, done: boolean): Promise<void>;
  updatePlayer(id: string, patch: Partial<Pick<Player, "name" | "avatar" | "color">>): Promise<void>;
  /** Notify when someone else checks in. */
  subscribe(cb: () => void): () => void;
}

export type GymInput = { name: string; latitude: number; longitude: number; radiusM: number };
