import type { Player } from "@/lib/types";

const isUrl = (s: string) => /^https?:\/\//.test(s);

/** Emoji or image avatar on a tinted disc in the player's color. */
export function Avatar({
  player,
  size = 44,
  ring = false,
  className = "",
}: {
  player: Pick<Player, "avatar" | "color" | "name">;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full select-none ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, ${player.color}38, ${player.color}14 70%)`,
        boxShadow: ring ? `0 0 0 2px var(--color-bg), 0 0 0 3.5px ${player.color}` : `inset 0 0 0 1px ${player.color}40`,
      }}
      aria-label={player.name}
      role="img"
    >
      {isUrl(player.avatar) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={player.avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>{player.avatar || player.name.slice(0, 1)}</span>
      )}
    </span>
  );
}
