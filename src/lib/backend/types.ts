import type { AppData, CheckInResult, Player, Settings } from "../types";

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
  signIn(email: string, password: string): Promise<void>;
  signUp(input: { email: string; password: string; name: string; inviteCode: string }): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  /** Freeze any finished weeks into weekly_results. Idempotent. */
  finalizeWeeks(): Promise<void>;
  load(): Promise<AppData>;
  checkIn(fix: { latitude: number; longitude: number; accuracy: number | null }): Promise<CheckInResult>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  /** Mark a week's group punishment done (or back to owed). */
  setPunishmentDone(weekStart: string, done: boolean): Promise<void>;
  updatePlayer(id: string, patch: Partial<Pick<Player, "name" | "avatar" | "color">>): Promise<void>;
  /** Notify when someone else checks in. */
  subscribe(cb: () => void): () => void;
}
