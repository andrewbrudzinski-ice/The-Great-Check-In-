"use client";

// Remembers (per device) the newest chat message you've seen, for the unread badge.
import { useSyncExternalStore } from "react";

const KEY = "tgci-chat-read";
const listeners = new Set<() => void>();

function get(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function markChatRead(iso: string) {
  try {
    const cur = localStorage.getItem(KEY);
    if (cur && cur >= iso) return;
    localStorage.setItem(KEY, iso);
  } catch {
    /* storage blocked: badge just won't clear on this device */
  }
  listeners.forEach((l) => l());
}

export function useChatLastRead(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      const onStorage = (e: StorageEvent) => e.key === KEY && l();
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(l);
        window.removeEventListener("storage", onStorage);
      };
    },
    get,
    () => null,
  );
}
