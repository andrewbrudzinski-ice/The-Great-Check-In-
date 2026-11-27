"use client";

import { useSyncExternalStore } from "react";

/** Where the layout switches to a side nav (Tailwind's `lg`). */
const QUERY = "(min-width: 1024px)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** True on a wide screen, where the tab bar becomes a side nav. Phones: false. */
export function useDesktop() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
