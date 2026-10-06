"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import "@/lib/install"; // start listening for the install prompt as early as possible
import { useApp } from "@/lib/store";
import { BottomNav } from "./BottomNav";

/** Auth gate + chrome. Every screen except /login renders only with data. */
export function Shell({ children }: { children: ReactNode }) {
  const { status, error, refresh, mode } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (status === "signedOut" && !isLogin) router.replace("/login");
    if (status === "ready" && isLogin) router.replace("/");
  }, [status, isLogin, router]);

  if (isLogin) return <>{children}</>;

  if (status === "error") {
    return (
      <Center>
        <p className="font-display text-2xl font-extrabold">Couldn&apos;t reach the club.</p>
        <p className="mt-2 max-w-xs text-sm text-muted">{error}</p>
        <button onClick={refresh} className="mt-6 rounded-full bg-volt px-6 py-3 font-display text-sm font-bold text-volt-ink">
          Try again
        </button>
      </Center>
    );
  }

  if (status !== "ready") {
    return (
      <Center>
        <span className="relative grid h-14 w-14 place-items-center">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-line-strong border-t-volt" />
        </span>
        <p className="eyebrow mt-5">Loading the club</p>
      </Center>
    );
  }

  return (
    <>
      {mode === "demo" && (
        <div className="fixed inset-x-0 top-0 z-40 flex justify-center pt-[max(var(--safe-top),4px)] pointer-events-none">
          <span className="rounded-b-lg bg-volt/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-volt/80 uppercase backdrop-blur">
            Demo mode
          </span>
        </div>
      )}
      <main className="mx-auto w-full max-w-lg px-4 pt-[calc(var(--safe-top)+20px)] pb-[calc(var(--safe-bottom)+104px)]">
        {children}
      </main>
      <BottomNav />
    </>
  );
}

function Center({ children }: { children: ReactNode }) {
  return <div className="grid min-h-dvh place-items-center px-6 text-center"><div className="flex flex-col items-center">{children}</div></div>;
}
