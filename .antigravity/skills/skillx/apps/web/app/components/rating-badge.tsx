interface RatingBadgeProps {
  score: number;
}

export function RatingBadge({ score }: RatingBadgeProps) {
  const tier = getTier(score);
  const tierColor = getTierColor(tier);

  return (
    <span className={`font-mono text-xs font-medium ${tierColor}`}>
      {tier} {score.toFixed(1)}
    </span>
  );
}

function getTier(score: number): string {
  if (score >= 9.0) return "S";
  if (score >= 7.5) return "A";
  if (score >= 6.0) return "B";
  return "C";
}

function getTierColor(tier: string): string {
  switch (tier) {
    case "S":
      return "text-tier-s";
    case "A":
      return "text-tier-a";
    case "B":
      return "text-tier-b";
    case "C":
      return "text-tier-c";
    default:
      return "text-sx-fg-muted";
  }
}
