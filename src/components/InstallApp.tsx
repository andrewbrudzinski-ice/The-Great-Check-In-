"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { rememberDismissed, useInstall, wasDismissedRecently, type Platform } from "@/lib/install";
import { CheckIcon, XIcon } from "./Icons";
import { Sheet } from "./ui";

/** Dismissible card on Home. Hidden once running from the home screen. */
export function InstallBanner() {
  const install = useInstall();
  const [dismissed, setDismissed] = useState(true);
  const [sheet, setSheet] = useState(false);
  useEffect(() => setDismissed(wasDismissedRecently()), []);

  // Phones only (or any browser that can actually install); desktop gets the Settings row.
  const show = install.ready && !install.installed && !dismissed && (install.platform !== "desktop" || install.canPrompt);

  async function go() {
    if (install.canPrompt) {
      if (await install.prompt()) setDismissed(true);
    } else {
      setSheet(true);
    }
  }

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="mt-8 flex items-center gap-3 overflow-hidden rounded-2xl border border-line bg-surface/70 p-3"
          >
            <AppIcon size={44} />
            <button onClick={go} className="min-w-0 flex-1 text-left">
              <p className="font-display text-[15px] leading-tight font-extrabold">Add to Home Screen</p>
              <p className="mt-0.5 text-xs text-muted">One tap to check in. Opens full screen like an app.</p>
            </button>
            <button onClick={go} className="shrink-0 rounded-full bg-volt px-3.5 py-2 font-display text-xs font-black text-volt-ink">
              {install.canPrompt ? "Install" : "Show me"}
            </button>
            <button
              onClick={() => {
                rememberDismissed();
                setDismissed(true);
              }}
              aria-label="Not now"
              className="shrink-0 rounded-full p-1 text-muted hover:text-ink"
            >
              <XIcon size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <InstallSheet open={sheet} onClose={() => setSheet(false)} platform={install.platform} />
    </>
  );
}

/** Always-available row for Settings. */
export function InstallRow() {
  const install = useInstall();
  const [sheet, setSheet] = useState(false);
  if (!install.ready) return null;

  if (install.installed) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface/50 px-4 py-3.5">
        <AppIcon size={36} />
        <span className="flex-1 text-sm">
          <span className="font-semibold">On your home screen</span>
          <span className="block text-xs text-muted">You&apos;re running the app version. Nice.</span>
        </span>
        <CheckIcon size={18} className="text-safe" strokeWidth={2.6} />
      </div>
    );
  }

  return (
    <>
      <button
        onClick={async () => (install.canPrompt ? install.prompt() : setSheet(true))}
        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface/50 px-4 py-3.5 text-left hover:border-line-strong"
      >
        <AppIcon size={36} />
        <span className="flex-1 text-sm">
          <span className="font-semibold">Add to Home Screen</span>
          <span className="block text-xs text-muted">Full screen, one tap away, no app store.</span>
        </span>
        <span className="text-sm text-muted">{install.canPrompt ? "Install" : "How →"}</span>
      </button>
      <InstallSheet open={sheet} onClose={() => setSheet(false)} platform={install.platform} />
    </>
  );
}

function InstallSheet({ open, onClose, platform }: { open: boolean; onClose: () => void; platform: Platform }) {
  const steps: { icon: ReactNode; text: ReactNode }[] =
    platform === "ios"
      ? [
          {
            icon: <ShareGlyph />,
            text: (
              <>
                Tap the <b className="text-ink">Share</b> button. In Safari it&apos;s at the bottom of the screen (top right on iPad).
              </>
            ),
          },
          {
            icon: <PlusSquareGlyph />,
            text: (
              <>
                Scroll down and tap <b className="text-ink">Add to Home Screen</b>.
              </>
            ),
          },
          { icon: <span className="font-display text-sm font-black text-ink">Add</span>, text: <>Tap <b className="text-ink">Add</b> in the top corner.</> },
        ]
      : platform === "android"
        ? [
            { icon: <DotsGlyph />, text: <>Tap the browser menu <b className="text-ink">⋮</b> (top right).</> },
            {
              icon: <PlusSquareGlyph />,
              text: (
                <>
                  Tap <b className="text-ink">Install app</b> or <b className="text-ink">Add to Home screen</b>.
                </>
              ),
            },
            { icon: <CheckIcon size={18} strokeWidth={2.6} />, text: <>Confirm. The icon lands on your home screen.</> },
          ]
        : [
            {
              icon: <PlusSquareGlyph />,
              text: (
                <>
                  In Chrome or Edge, click the <b className="text-ink">install icon</b> at the right end of the address bar.
                </>
              ),
            },
            {
              icon: <span className="text-base">📱</span>,
              text: <>Best on your phone: open this site there and add it to your home screen.</>,
            },
          ];

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="pb-2">
        <div className="flex items-center gap-3">
          <AppIcon size={52} />
          <div>
            <h3 className="font-display text-2xl leading-tight font-black">Add to Home Screen</h3>
            <p className="text-xs text-muted">{platform === "ios" ? "Works in Safari, and in Chrome on iOS 16.4+" : "Takes 5 seconds"}</p>
          </div>
        </div>
        <ol className="mt-6 space-y-4">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-3.5">
              <span className="font-display tabular w-4 text-sm font-black text-muted">{i + 1}</span>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-volt">{s.icon}</span>
              <span className="text-[15px] leading-snug text-ink-2">{s.text}</span>
            </li>
          ))}
        </ol>
        {platform === "ios" && (
          <motion.div
            className="mt-6 flex justify-center text-volt"
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          >
            <span className="text-xs font-semibold">The Share button is down there ↓</span>
          </motion.div>
        )}
        <button onClick={onClose} className="mt-6 w-full rounded-2xl bg-surface-3 py-3.5 font-display font-bold">
          Got it
        </button>
      </div>
    </Sheet>
  );
}

function AppIcon({ size }: { size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icon-192.png" alt="" width={size} height={size} className="shrink-0 rounded-[22%] ring-1 ring-line-strong" />;
}

const glyph = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

/** iOS share icon: box with an up arrow. */
const ShareGlyph = () => (
  <svg {...glyph}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
  </svg>
);
const PlusSquareGlyph = () => (
  <svg {...glyph}>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M12 8.5v7M8.5 12h7" />
  </svg>
);
const DotsGlyph = () => (
  <svg {...glyph} fill="currentColor" stroke="none">
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);
