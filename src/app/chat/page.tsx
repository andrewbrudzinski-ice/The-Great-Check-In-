"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ChatIcon, SendIcon } from "@/components/Icons";
import { markChatRead } from "@/lib/chatRead";
import { useGame } from "@/lib/store";
import { useDesktop } from "@/lib/useDesktop";
import { REACTIONS, type ChatMessage, type Player } from "@/lib/types";
import { formatTime, localDate, longDate } from "@/lib/week";

/** Height of the bottom tab bar (without the safe-area inset). On wide screens the nav is on the side: 0. */
const NAV_H = 60;
/** The page's own bottom padding (Shell's <main>), which already clears the tab bar. 48 on wide screens. */
const MAIN_PB = 104;
const MAIN_PB_DESKTOP = 48;
/** Breathing room between the newest message and the message box. */
const GAP = 12;

/**
 * How far the on-screen keyboard covers the page. iPhone browsers shrink the
 * visual viewport for the keyboard without resizing the page, so a composer
 * pinned to the bottom would otherwise sit under the keyboard.
 */
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

export default function ChatPage() {
  const { data, me, sendMessage } = useGame();
  const tz = data.settings.timezone;
  const messages = data.messages;
  const byId = useMemo(() => new Map(data.players.map((p) => [p.id, p])), [data.players]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const [composerH, setComposerH] = useState(66);
  const keyboard = useKeyboardInset();
  const desktop = useDesktop();
  const navH = desktop ? 0 : NAV_H;
  const mainPb = desktop ? MAIN_PB_DESKTOP : MAIN_PB;

  // The message box grows with what you type; keep exactly enough room under the newest message.
  useLayoutEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const measure = () => setComposerH(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const last = messages[messages.length - 1];

  // Seen everything that's on screen.
  useEffect(() => {
    markChatRead(last?.createdAt ?? new Date().toISOString());
  }, [last?.createdAt]);

  // Open at the newest message. The router (and late-loading avatars) can move
  // the page after the first paint, so keep pinning to the bottom for a moment,
  // and stop the instant you touch or scroll yourself.
  useLayoutEffect(() => {
    const toBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    toBottom();
    let raf = requestAnimationFrame(function tick() {
      toBottom();
      raf = requestAnimationFrame(tick);
    });
    const stop = () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("keydown", stop);
    };
    const timer = setTimeout(stop, 800);
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("keydown", stop);
    return stop;
  }, []);

  // Stick to the bottom when new messages arrive (or the keyboard opens).
  useLayoutEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
  }, [messages.length, keyboard, composerH]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setError(null);
    setText("");
    setSelected(null);
    try {
      await sendMessage(body);
    } catch (e) {
      setText(body);
      setError(e instanceof Error ? e.message : "Couldn't send.");
    }
    inputRef.current?.focus();
  }

  // Auto-grow the text box up to ~5 lines.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [text]);

  const composerBottom = keyboard > 0 ? keyboard : desktop ? 0 : `calc(${NAV_H}px + var(--safe-bottom))`;

  return (
    <div>
      <header className="mb-4">
        <p className="eyebrow mb-1.5">{data.players.length} members</p>
        <h1 className="font-big text-[clamp(44px,15vw,60px)] leading-[0.86]">Club chat</h1>
      </header>

      {messages.length === 0 ? (
        <div className="py-16 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-volt shadow-[inset_0_0_0_1px_var(--color-line)]" aria-hidden>
            <ChatIcon size={24} />
          </span>
          <p className="font-display mt-4 text-xl font-extrabold">Dead quiet in here.</p>
          <p className="mt-1 text-sm text-muted">Say something. Talk some trash. Plan a lift.</p>
        </div>
      ) : (
        <ol className="space-y-0.5" onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const day = localDate(m.createdAt, tz);
            const newDay = !prev || localDate(prev.createdAt, tz) !== day;
            // Group consecutive messages from the same person within 5 minutes.
            const sameRun = (a?: ChatMessage, b?: ChatMessage) =>
              !!a && !!b && a.userId === b.userId && localDate(a.createdAt, tz) === localDate(b.createdAt, tz) &&
              Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < 5 * 60000;
            const grouped = sameRun(prev, m);
            const endOfRun = !sameRun(m, messages[i + 1]);
            return (
              <li key={m.id}>
                {newDay && <DaySeparator day={day} tz={tz} />}
                <Bubble
                  message={m}
                  author={byId.get(m.userId)}
                  mine={m.userId === me?.id}
                  grouped={grouped}
                  showTime={endOfRun}
                  tz={tz}
                  selected={selected === m.id}
                  onSelect={() => setSelected(selected === m.id ? null : m.id)}
                />
              </li>
            );
          })}
        </ol>
      )}
      {/* Room for the message box, so the newest message sits just above it. */}
      <div aria-hidden style={{ height: Math.max(0, composerH + navH + GAP - mainPb) }} />

      {/* Composer: above the tab bar (at the bottom, clear of the home bar, on wide screens), or right on top of the keyboard when it's open */}
      <div
        ref={composerRef}
        className="fixed inset-x-0 z-30 border-t border-line bg-bg/90 backdrop-blur-xl lg:left-[232px] lg:pb-[var(--safe-bottom)]"
        style={{ bottom: composerBottom }}
      >
        <form
          className="mx-auto flex max-w-lg items-end gap-2 px-4 py-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends on a keyboard; Shift+Enter is a new line. (Phones use the button.)
              if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Message the club…`}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-[22px] border border-line bg-surface px-4 py-2.5 text-ink outline-none placeholder:text-muted/70 focus:border-volt/60"
            aria-label="Message"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="pressable grid h-11 w-11 shrink-0 place-items-center rounded-full bg-volt text-volt-ink transition-opacity disabled:opacity-30"
            aria-label="Send"
          >
            <SendIcon size={20} strokeWidth={2.2} />
          </button>
        </form>
        {error && <p className="mx-auto max-w-lg px-5 pb-2 text-xs text-problem">{error}</p>}
      </div>
    </div>
  );
}

function DaySeparator({ day, tz }: { day: string; tz: string }) {
  const today = localDate(new Date(), tz);
  const yesterday = localDate(new Date(Date.now() - 86400000), tz);
  const label = day === today ? "Today" : day === yesterday ? "Yesterday" : longDate(day);
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-[10px] font-semibold tracking-wider text-muted uppercase">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function Bubble({
  message: m,
  author,
  mine,
  grouped,
  showTime,
  tz,
  selected,
  onSelect,
}: {
  message: ChatMessage;
  author?: Player;
  mine: boolean;
  grouped: boolean;
  showTime: boolean;
  tz: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { data, me, deleteMessage, toggleReaction } = useGame();
  const [error, setError] = useState<string | null>(null);
  const pending = m.id.startsWith("pending-");
  const reactions = data.reactions.filter((r) => r.messageId === m.id);
  const counts = REACTIONS.map((e) => ({
    emoji: e,
    n: reactions.filter((r) => r.emoji === e).length,
    mine: reactions.some((r) => r.emoji === e && r.userId === me?.id),
    who: reactions.filter((r) => r.emoji === e).map((r) => data.players.find((p) => p.id === r.userId)?.name ?? "?"),
  })).filter((c) => c.n > 0);
  const canDelete = !m.deleted && !pending && (mine || !!me?.isAdmin);

  async function act(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't do that.");
    }
  }

  return (
    <div className={`flex gap-2 ${mine ? "flex-row-reverse" : ""} ${grouped ? "" : "mt-3"}`}>
      {!mine && <div className="w-8 shrink-0">{!grouped && author && <Avatar player={author} size={32} />}</div>}
      <div className={`flex max-w-[78%] min-w-0 flex-col ${mine ? "items-end" : "items-start"}`}>
        {!grouped && !mine && (
          <span className="mb-0.5 px-1 text-xs font-semibold" style={{ color: author?.color }}>
            {author?.name ?? "Someone"}
          </span>
        )}
        <button
          onClick={() => !m.deleted && !pending && onSelect()}
          className={`rounded-[20px] px-3.5 py-2 text-left text-[15px] leading-snug break-words whitespace-pre-wrap transition-opacity ${
            m.deleted
              ? "border border-dashed border-line-strong text-muted italic"
              : mine
                ? `bg-volt text-volt-ink ${pending ? "opacity-60" : ""}`
                : "bg-surface-2 text-ink"
          } ${selected ? "ring-2 ring-ink/40" : ""}`}
          aria-label={m.deleted ? "Deleted message" : `${author?.name ?? "Someone"}: ${m.body}. Tap to react.`}
        >
          {m.deleted ? "Message deleted" : m.body}
        </button>

        {counts.length > 0 && (
          // Chips overlap the bubble's bottom edge, so they're solid (yours: lime at 15% over the page) and a lime bubble can't show through.
          <div className={`-mt-1.5 flex flex-wrap gap-1 px-2 ${mine ? "justify-end" : ""}`}>
            {counts.map((c) => (
              <button
                key={c.emoji}
                onClick={() => act(() => toggleReaction(m.id, c.emoji))}
                title={c.who.join(", ")}
                className={`rounded-full border px-1.5 py-[1px] text-xs tabular ${
                  c.mine ? "border-volt/50 bg-[#252e13] text-ink" : "border-line bg-surface text-ink-2"
                }`}
              >
                {c.emoji} {c.n > 1 ? c.n : ""}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence initial={false}>
          {selected && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-1.5 flex items-center gap-1 rounded-full border border-line bg-surface px-1.5 py-1 shadow-lg ${mine ? "self-end" : ""}`}
            >
              {REACTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => act(() => toggleReaction(m.id, e)).then(onSelect)}
                  className="grid h-8 w-8 place-items-center rounded-full text-lg active:scale-90"
                  aria-label={`React ${e}`}
                >
                  {e}
                </button>
              ))}
              {canDelete && (
                <button
                  onClick={() => confirm("Delete this message?") && act(() => deleteMessage(m.id)).then(onSelect)}
                  className="ml-1 rounded-full px-2 py-1 text-xs font-semibold text-problem"
                >
                  Delete
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {(showTime || pending) && (
          <span className="mt-0.5 px-1 text-[10px] text-muted tabular">{pending ? "Sending…" : formatTime(m.createdAt, tz)}</span>
        )}
        {error && <span className="px-1 text-xs text-problem">{error}</span>}
      </div>
    </div>
  );
}
