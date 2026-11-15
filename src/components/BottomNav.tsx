"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useApp } from "@/lib/store";
import { useChatLastRead } from "@/lib/chatRead";
import { ChatIcon, FlameIcon, HomeIcon, MapIcon, TrophyIcon, UserIcon } from "./Icons";

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
  const { data, session } = useApp();
  const lastRead = useChatLastRead();
  // Unread = other people's messages newer than the last one you saw here.
  // Before you've ever opened the chat on this device, nothing counts as unread.
  const unread =
    lastRead && data
      ? data.messages.filter((m) => !m.deleted && m.userId !== session?.userId && m.createdAt > lastRead).length
      : 0;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/80 backdrop-blur-xl"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {TABS.map(({ href, label, Icon, also, also2 }) => {
          const active =
            (href === "/" ? pathname === "/" : pathname.startsWith(href)) ||
            (!!also && pathname.startsWith(also)) ||
            (!!also2 && pathname.startsWith(also2));
          const badge = href === "/chat" && !active && unread > 0 ? unread : 0;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[10px] font-semibold whitespace-nowrap transition-colors ${
                  active ? "text-ink" : "text-muted hover:text-ink-2"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-dot"
                    className="absolute top-0 h-[2px] w-8 rounded-full bg-volt"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative">
                  <Icon size={22} strokeWidth={active ? 2.1 : 1.7} />
                  {badge > 0 && (
                    <span
                      className="absolute -top-1.5 -right-2.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-problem px-1 text-[10px] leading-none font-bold text-white tabular"
                      aria-label={`${badge} unread`}
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
