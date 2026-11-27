import { computeGame } from "./game";
import type { AppData } from "./types";

/**
 * The last club data this phone saw, so the app can draw the board the moment
 * it opens and refresh from the server behind it. One copy per player, on this
 * device only; signing out clears them. Bump VERSION whenever AppData changes
 * shape, so an old copy is never read by new code.
 */
const VERSION = 1;
const PREFIX = "tgci-club:";

export type SavedClub = { userId: string; email?: string; data: AppData };

/** The saved copy for this player, or null. */
export function savedClub(id: string): SavedClub | null {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved?.v !== VERSION || !saved.data?.players || !saved.data?.settings) return null;
    // Anything the game can't compute from is no use: start fresh instead.
    computeGame(saved.data, new Date());
    return { userId: id, email: saved.email, data: saved.data };
  } catch {
    return null;
  }
}

export function saveClub(userId: string, email: string | undefined, data: AppData) {
  try {
    localStorage.setItem(PREFIX + userId, JSON.stringify({ v: VERSION, email, data }));
  } catch {
    /* storage full or blocked: the app just loads from the server next time */
  }
}

export function forgetClub() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
