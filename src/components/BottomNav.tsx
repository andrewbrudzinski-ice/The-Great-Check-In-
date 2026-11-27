"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { haptics } from "@/lib/haptics";
import { useApp } from "@/lib/store";
import { useChatLastRead } from "@/lib/chatRead";
import { ChatIcon, FlameIcon, HomeIcon, MapIcon, TrophyIcon, UserIcon } from "./Icons";
import { Mark } from "./Mark";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon, also: "/challenges" },
  { href: "/map", label: "Map", Icon: MapIcon },
  { href: "/standings", label: "Standings", Icon: TrophyIcon, also: "/punishments", also2: "/history" },
  { href: "/hard", label: "75 Hard", Icon: FlameIcon },
  { href: "/chat", label: "Chat", Icon: ChatIcon },
  { href: "/profile", label: "Profile", Icon: UserIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  // The tab you just tapped, until its screen shows. Lights it up instantly so
  // a slow moment never looks like a missed tap.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(null), 8000); // never get stuck
    return () => clearTimeout(t);
  }, [pending]);
  // Load every tab's screen in the background so taps open instantly.
  useEffect(() => {
    for (const t of TABS) router.prefetch(t.href);
  }, [router]);
  const current = pending ?? pathname;
  const activeIndex = TABS.findIndex(
    ({ href, also, also2 }) =>
      (href === "/" ? current === "/" : current.startsWith(href)) ||
      (!!also && current.startsWith(also)) ||
      (!!also2 && current.startsWith(also2)),
  );
  const { data, session } = useApp();
  const lastRead = useChatLastRead();
  // Unread = other people's messages newer than the last one you saw here.
  // Before you've ever opened the chat on this device, nothing counts as unread.
  const unread =
    lastRead && data
      ? data.messages.filter((m) => !m.deleted && m.userId !== session?.userId && m.createdAt > lastRead).length
      : 0;
  return (
    <>
      {pending && (
        <div className="fixed inset-x-0 top-0 z-[70] h-[2px] overflow-hidden" aria-hidden>
          <div className="h-full w-1/3 animate-[navload_0.9s_ease-in-out_infinite] rounded-full bg-volt" />
        </div>
      )}
    {/* A tab bar along the bottom on phones; a side nav on wide screens (lg). */}
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 backdrop-blur-xl backdrop-saturate-150 lg:inset-y-0 lg:right-auto lg:w-[232px] lg:border-t-0 lg:border-r lg:bg-bg lg:backdrop-blur-none"
      aria-label="Main"
    >
      <div className="hidden items-center gap-2.5 px-6 pt-8 pb-7 lg:flex">
        <Mark size={22} />
        <span className="font-display text-[13px] leading-tight font-extrabold tracking-[0.02em] uppercase">The Great Check In</span>
      </div>
      <ul className="relative mx-auto flex max-w-lg items-stretch justify-around px-1 lg:mx-0 lg:max-w-none lg:flex-col lg:justify-start lg:gap-1 lg:px-3">
        {/* One highlight bar that slides to the active tab. Plain CSS on purpose:
            it only ever moves along the bar, whatever the page scroll does. */}
        <span
          aria-hidden
          data-nav-indicator
          className="pointer-events-none absolute top-0 h-[2px] w-8 rounded-b-full bg-volt transition-[left,opacity] duration-[340ms] ease-[cubic-bezier(0.3,1.25,0.5,1)] motion-reduce:transition-none lg:hidden"
          style={{
            left: `calc(4px + (100% - 8px) * ${(Math.max(0, activeIndex) + 0.5) / TABS.length} - 16px)`,
            opacity: activeIndex < 0 ? 0 : 1,
          }}
        />
        {/* Side nav: the same bar, standing up, at the left edge. Rows are 44px + 4px gap. */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 hidden h-5 w-[3px] rounded-r-full bg-volt transition-[top,opacity] duration-[340ms] ease-[cubic-bezier(0.3,1.25,0.5,1)] motion-reduce:transition-none lg:block"
          style={{ top: Math.max(0, activeIndex) * 48 + 12, opacity: activeIndex < 0 ? 0 : 1 }}
        />
        {TABS.map(({ href, label, Icon }, i) => {
          const active = i === activeIndex;
          const badge = href === "/chat" && !active && unread > 0 ? unread : 0;
          return (
            <li key={href} className="flex-1 lg:flex-none">
              <Link
                href={href}
                // Chat opens at the newest message on its own; don't let the router jump it to the top.
                scroll={href !== "/chat"}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  if (href !== pathname) {
                    haptics.tap();
                    setPending(href);
                  }
                }}
                // The whole column is tappable, down through the home-bar area.
                className={`group relative flex h-full flex-col items-center gap-1 pt-2.5 pb-[calc(8px+var(--safe-bottom))] text-[10.5px] whitespace-nowrap transition-colors duration-200 select-none lg:h-11 lg:flex-row lg:gap-3 lg:rounded-xl lg:px-3 lg:pt-0 lg:pb-0 lg:text-[14px] lg:[&_svg]:size-5 ${
                  active ? "font-semibold text-ink lg:bg-surface-2" : "font-medium text-muted hover:text-ink-2 lg:hover:bg-surface"
                }`}
              >
                <span className="relative transition-transform duration-100 group-active:scale-[0.88]">
                  {/* Pops once when the tab becomes active. */}
                  <motion.span
                    key={active ? "on" : "off"}
                    className="block"
                    initial={active ? { scale: 0.8 } : false}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 520, damping: 18 }}
                  >
                    <Icon size={23} strokeWidth={active ? 1.9 : 1.6} />
                  </motion.span>
                  {badge > 0 && (
                    <motion.span
                      key={badge}
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 600, damping: 16 }}
                      className="absolute -top-1.5 -right-2.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-problem px-1 text-[10px] leading-none font-bold text-white tabular shadow-[0_0_0_2px_var(--color-bg)]"
                      aria-label={`${badge} unread`}
                    >
                      {badge > 9 ? "9+" : badge}
                    </motion.span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
    </>
  );
}
