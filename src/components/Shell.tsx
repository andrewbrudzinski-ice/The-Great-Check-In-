"use client";

import { MotionConfig } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import "@/lib/install"; // start listening for the install prompt as early as possible
import { useApp } from "@/lib/store";
import { BottomNav } from "./BottomNav";
import { AlertIcon } from "./Icons";
import { OfflineBanner } from "./Offline";

/** Auth gate + chrome. Every screen except /login renders only with data. */
export function Shell({ children }: { children: ReactNode }) {
  // "user": follow the phone's Reduce Motion setting for every animation.
  return (
    <MotionConfig reducedMotion="user">
      <Chrome>{children}</Chrome>
    </MotionConfig>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  const { status, error, refresh, mode } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const wide = pathname === "/" || pathname.startsWith("/map");

  useEffect(() => {
    if (status === "signedOut" && !isLogin) router.replace("/login");
    if (status === "ready" && isLogin) router.replace("/");
  }, [status, isLogin, router]);

  if (isLogin) return <>{children}</>;

  if (status === "error") {
    return (
      <Center>
        <span className="grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]" aria-hidden>
          <AlertIcon size={24} />
        </span>
        <p className="font-big mt-5 text-[40px] leading-[0.9] uppercase">Couldn&apos;t reach the club.</p>
        <p className="mt-3 max-w-xs text-sm text-muted">{error}</p>
        <button onClick={refresh} className="pressable mt-7 h-12 rounded-full bg-volt px-7 font-display text-[15px] font-extrabold text-volt-ink">
          Try again
        </button>
      </Center>
    );
  }

  if (status !== "ready") return <LoadingSkeleton />;

  return (
    <>
      {mode === "demo" && (
        <div className="fixed inset-x-0 top-0 z-40 flex justify-center pt-[max(var(--safe-top),4px)] pointer-events-none lg:left-[232px]">
          <span className="rounded-b-lg bg-volt/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-volt/80 uppercase backdrop-blur">
            Demo mode
          </span>
        </div>
      )}
      {/* On wide screens the nav sits on the left; on the widest, Home and the Map use two columns. */}
      <div className="lg:pl-[232px]">
        <main
          className={`mx-auto w-full max-w-lg px-4 pt-[calc(var(--safe-top)+20px)] pb-[calc(var(--safe-bottom)+104px)] lg:pt-10 lg:pb-12 ${
            wide ? "xl:max-w-[1120px] xl:px-10" : ""
          }`}
        >
          <OfflineBanner />
          {children}
        </main>
      </div>
      <BottomNav />
    </>
  );
}

function Center({ children }: { children: ReactNode }) {
  return <div className="grid min-h-dvh place-items-center px-6 text-center"><div className="flex flex-col items-center">{children}</div></div>;
}

/** Shaped like Home, with a slow sheen, so opening the app never shows a bare spinner. */
function LoadingSkeleton() {
  const bar = "rounded-md bg-[linear-gradient(110deg,var(--color-surface-2)_30%,var(--color-surface-3)_50%,var(--color-surface-2)_70%)] bg-[length:200%_100%] animate-shimmer";
  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-[calc(var(--safe-top)+20px)]" aria-busy="true">
      <p className="sr-only">Loading the club</p>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className={`${bar} h-3.5 w-40`} />
          <div className={`${bar} h-2.5 w-28`} />
        </div>
        <div className={`${bar} h-9 w-9 rounded-full`} />
      </div>
      <div className="mt-9 flex items-end justify-between">
        <div className={`${bar} h-[136px] w-28 rounded-xl`} />
        <div className="space-y-2">
          <div className={`${bar} h-9 w-32`} />
          <div className={`${bar} ml-auto h-2.5 w-24`} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-[5px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`${bar} h-3 rounded-[3px]`} />
        ))}
      </div>
      <div className={`${bar} mt-6 h-20 rounded-[24px]`} />
      <div className="mt-11 space-y-7">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="flex items-center gap-3">
              <div className={`${bar} h-7 w-6`} />
              <div className="flex-1 space-y-1.5">
                <div className={`${bar} h-4 w-28`} />
                <div className={`${bar} h-2.5 w-44`} />
              </div>
              <div className={`${bar} h-8 w-12`} />
            </div>
            <div className={`${bar} mt-3 ml-9 h-2 rounded-full`} />
          </div>
        ))}
      </div>
    </div>
  );
}
