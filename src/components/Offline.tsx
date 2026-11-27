"use client";

import { AnimatePresence, motion } from "motion/react";
import { useSyncExternalStore } from "react";
import { useApp } from "@/lib/store";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** True while the phone has a connection (assumed online before hydration). */
export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/**
 * A slim notice at the top of the screen while the phone is offline (check-ins
 * need the server), or when a refresh failed and the screen shows the last
 * update. It sits in the page flow and pushes it down, so it never covers anything.
 */
export function OfflineBanner() {
  const online = useOnline();
  const { refreshError, refresh } = useApp();
  const stale = online && !!refreshError;
  return (
    <AnimatePresence initial={false}>
      {stale && (
        <motion.div
          key="stale"
          role="status"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.25, 0.9, 0.25, 1] }}
          className="overflow-hidden"
        >
          <p className="mb-4 flex items-center gap-2 rounded-xl bg-surface-2 py-1.5 pr-1.5 pl-3.5 font-mono text-[10.5px] tracking-[0.06em] text-ink uppercase shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
            <span className="flex-1">Couldn&apos;t refresh · showing your last update</span>
            <button onClick={() => refresh()} className="pressable rounded-lg px-2.5 py-1.5 text-volt">
              Retry
            </button>
          </p>
        </motion.div>
      )}
      {!online && (
        <motion.div
          key="offline"
          role="status"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.25, 0.9, 0.25, 1] }}
          className="overflow-hidden"
        >
          <p className="mb-4 flex items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 font-mono text-[10.5px] tracking-[0.06em] text-ink uppercase shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-problem" />
            Offline · check-ins need a connection
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
