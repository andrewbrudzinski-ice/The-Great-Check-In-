"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { HistoryIcon, HomeIcon, MapIcon, TrophyIcon, UserIcon } from "./Icons";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/map", label: "Map", Icon: MapIcon },
  { href: "/standings", label: "Standings", Icon: TrophyIcon, also: "/punishments" },
  { href: "/history", label: "History", Icon: HistoryIcon },
  { href: "/profile", label: "Profile", Icon: UserIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/80 backdrop-blur-xl"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {TABS.map(({ href, label, Icon, also }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href) || (!!also && pathname.startsWith(also));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[10px] font-semibold tracking-wide transition-colors ${
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
                <Icon size={22} strokeWidth={active ? 2.1 : 1.7} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
