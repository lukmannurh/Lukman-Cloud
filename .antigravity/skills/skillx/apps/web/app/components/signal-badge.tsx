/** Small pill badge showing quality signals on leaderboard entries */

const BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  "top-rated": { label: "Top Rated", className: "bg-yellow-500/10 text-yellow-400" },
  "popular": { label: "Popular", className: "bg-sx-accent-muted text-sx-accent" },
  "trending": { label: "Trending", className: "bg-orange-500/10 text-orange-400" },
  "well-maintained": { label: "Maintained", className: "bg-blue-500/10 text-blue-400" },
  "community-pick": { label: "Community Pick", className: "bg-pink-500/10 text-pink-400" },
};

interface SignalBadgeProps {
  type: string;
}

export function SignalBadge({ type }: SignalBadgeProps) {
  const config = BADGE_CONFIG[type];
  if (!config) return null;

  return (
    <span
      className={`ml-1.5 inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${config.className}`}
    >
      {config.label}
    </span>
  );
}
