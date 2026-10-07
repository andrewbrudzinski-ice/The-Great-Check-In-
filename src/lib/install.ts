"use client";

// "Add to Home Screen" support.
//  - Android / desktop Chrome & Edge fire `beforeinstallprompt`; we stash it and
//    offer a one-tap Install button.
//  - iOS has no prompt API, so we show Share → Add to Home Screen instructions.
//  - Once the app is running from the home screen we hide all of it.
import { useEffect, useState, useSyncExternalStore } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// The event can fire before React mounts, so listen at module load.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep Chrome's mini-infobar quiet; we show our own button
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    emit();
  });
}

export type Platform = "ios" | "android" | "desktop";
/** Every iPhone browser is WebKit, but each puts the Share button somewhere else. */
export type IosBrowser = "safari" | "chrome" | "other";

function detectIosBrowser(): IosBrowser {
  const ua = navigator.userAgent;
  if (/CriOS/i.test(ua)) return "chrome";
  if (/FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua)) return "other";
  return "safari";
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useInstall() {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  const justInstalled = useSyncExternalStore(subscribe, () => installedNow, () => false);
  // Platform/standalone only exist in the browser; resolve after mount.
  const [env, setEnv] = useState<{ platform: Platform; iosBrowser: IosBrowser; standalone: boolean } | null>(null);
  useEffect(() => {
    setEnv({ platform: detectPlatform(), iosBrowser: detectIosBrowser(), standalone: isStandalone() });
  }, []);

  async function prompt(): Promise<boolean> {
    if (!deferred) return false;
    const e = deferred;
    deferred = null; // a prompt event can only be used once
    emit();
    await e.prompt();
    const { outcome } = await e.userChoice;
    return outcome === "accepted";
  }

  return {
    ready: env !== null,
    platform: env?.platform ?? "desktop",
    iosBrowser: env?.iosBrowser ?? "safari",
    installed: !!env?.standalone || justInstalled,
    canPrompt,
    prompt,
  };
}

const DISMISS_KEY = "tgci-install-dismissed";

/** Remember "not now" for two weeks so the banner doesn't nag. */
export function wasDismissedRecently(): boolean {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - t < 14 * 86400000;
  } catch {
    return false;
  }
}

export function rememberDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* storage blocked — banner just comes back next visit */
  }
}
