"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Receipt } from "@/components/Receipt";
import { PageTitle } from "@/components/ui";
import { formatDistance } from "@/lib/geo";
import { approvedGyms } from "@/lib/gyms";
import { useGame } from "@/lib/store";
import { formatDateTime, weekKey } from "@/lib/week";

const CheckInMap = dynamic(() => import("@/components/CheckInMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface" />,
});

export default function MapPage() {
  return (
    <Suspense>
      <GymMap />
    </Suspense>
  );
}

function GymMap() {
  const { data, game } = useGame();
  const tz = data.settings.timezone;
  // ?checkin=<id> opens straight to that check-in's receipt
  const linked = data.checkIns.find((c) => c.id === useSearchParams().get("checkin")) ?? null;
  const [who, setWho] = useState<string | "all">("all");
  const [range, setRange] = useState<"week" | "all">(() =>
    linked && weekKey(linked.checkedInAt, tz) !== game.weekStart ? "all" : "week",
  );
  const [selected, setSelected] = useState<string | null>(linked?.id ?? null);

  const visible = useMemo(
    () =>
      data.checkIns.filter(
        (c) => (who === "all" || c.userId === who) && (range === "all" || weekKey(c.checkedInAt, tz) === game.weekStart),
      ),
    [data.checkIns, who, range, tz, game.weekStart],
  );
  const list = useMemo(() => visible.slice().reverse().slice(0, 60), [visible]);
  const byId = (id: string) => data.players.find((p) => p.id === id);
  const gymCount = approvedGyms(data.gyms).length;
  const selectedCheckIn = visible.find((c) => c.id === selected) ?? null;

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
      active ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:text-ink"
    }`;

  return (
    <div>
      <PageTitle
        eyebrow={
          <Link href="/gyms" className="hover:text-ink">
            {gymCount} gym{gymCount === 1 ? "" : "s"} · manage →
          </Link>
        }
        title="Gym Map"
        right={
          <div className="flex rounded-full bg-surface-2 p-0.5 text-xs font-semibold">
            {(["week", "all"] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`rounded-full px-3 py-1.5 ${range === r ? "bg-surface-3 text-ink" : "text-muted"}`}>
                {r === "week" ? "This week" : "All time"}
              </button>
            ))}
          </div>
        }
      />

      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
        <button className={chip(who === "all")} onClick={() => setWho("all")}>
          Everyone
        </button>
        {data.players.map((p) => (
          <button key={p.id} className={`${chip(who === p.id)} flex items-center gap-1.5`} onClick={() => setWho(p.id)}>
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </button>
        ))}
      </div>

      <div className="relative -mx-4 h-[52dvh] min-h-[300px] overflow-hidden border-y border-line sm:mx-0 sm:rounded-3xl sm:border">
        <CheckInMap
          checkIns={visible}
          players={data.players}
          gyms={data.gyms}
          timezone={tz}
          selectedId={selected}
          onSelect={setSelected}
          className="h-full w-full"
        />
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-full bg-bg/80 px-3 py-1.5 text-[11px] font-semibold text-ink-2 backdrop-blur">
          {visible.length} check-in{visible.length === 1 ? "" : "s"}
        </div>
      </div>

      {selectedCheckIn && byId(selectedCheckIn.userId) ? (
        <div className="mt-4">
          <Receipt
            checkIn={selectedCheckIn}
            player={byId(selectedCheckIn.userId)!}
            settings={data.settings}
            onClose={() => setSelected(null)}
          />
        </div>
      ) : (
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Tap any pin or check-in to see its receipt: exact location, GPS accuracy and distance from the gym. Location is
          read only when someone taps Check In. No background tracking.
        </p>
      )}

      <ul className="mt-5 divide-y divide-line">
        {list.length === 0 && (
          <li className="py-8 text-center text-sm text-muted">
            {range === "week" ? "No pins this week. The map is begging for attention." : "No check-ins yet. Be the first pin."}
          </li>
        )}
        {list.map((c) => {
          const p = byId(c.userId);
          if (!p) return null;
          return (
            <li key={c.id}>
              <button
                onClick={() => {
                  setSelected(c.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`flex w-full items-center gap-3 py-3 text-left ${selected === c.id ? "opacity-100" : "opacity-90"}`}
              >
                <Avatar player={p} size={34} ring={selected === c.id} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="truncate text-xs text-muted">
                    {c.gymName}
                    {c.distanceM != null && (
                      <>
                        {" · "}
                        <span className="text-safe">✓</span> {formatDistance(c.distanceM)} from gym
                      </>
                    )}
                    {c.accuracy != null && ` · ±${formatDistance(c.accuracy)}`}
                  </p>
                </div>
                <span className="tabular text-right text-xs text-ink-2">{formatDateTime(c.checkedInAt, tz)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
