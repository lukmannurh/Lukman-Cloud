import {
  Download,
  Star,
  Activity,
  GitBranch,
  Tag,
  Calendar,
  Heart,
  Bot,
  User,
  ExternalLink,
} from "lucide-react";

interface SkillDetailSidebarProps {
  installs: number;
  avgRating: number;
  ratingCount: number;
  humanRatingCount: number;
  agentRatingCount: number;
  successRate: number;
  totalUsages: number;
  sourceUrl: string | null;
  category: string;
  version: string;
  createdAt: number | Date;
  favoriteCount: number;
  modelBreakdown: { model: string; count: number }[];
}

export function SkillDetailSidebar({
  installs,
  avgRating,
  ratingCount,
  humanRatingCount,
  agentRatingCount,
  successRate,
  totalUsages,
  sourceUrl,
  category,
  version,
  createdAt,
  favoriteCount,
  modelBreakdown,
}: SkillDetailSidebarProps) {
  return (
    <aside className="space-y-0 divide-y divide-sx-border lg:sticky lg:top-20">
      {/* Total Installs */}
      <StatCard label="Total Installs" icon={<Download size={14} />}>
        <span className="font-mono text-3xl font-bold text-sx-fg">
          {formatNumber(installs)}
        </span>
      </StatCard>

      {/* Rating */}
      <StatCard label="Community Rating" icon={<Star size={14} />}>
        <div className="flex items-baseline gap-2">
          <span className={`font-mono text-2xl font-bold ${getTierColor(avgRating)}`}>
            {getTier(avgRating)} {avgRating.toFixed(1)}
          </span>
          <span className="text-xs text-sx-fg-muted">/ 10</span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-sx-fg-muted">
          <span className="flex items-center gap-1">
            <User size={11} /> {humanRatingCount}
          </span>
          <span className="flex items-center gap-1">
            <Bot size={11} /> {agentRatingCount}
          </span>
        </div>
      </StatCard>

      {/* Success Rate */}
      <StatCard label="Success Rate" icon={<Activity size={14} />}>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-sx-accent">
            {totalUsages > 0 ? `${successRate.toFixed(1)}%` : "—"}
          </span>
        </div>
        <p className="mt-1 text-xs text-sx-fg-muted">
          {formatNumber(totalUsages)} total runs
        </p>
      </StatCard>

      {/* Repository */}
      {sourceUrl && (
        <StatCard label="Repository" icon={<GitBranch size={14} />}>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-sx-accent transition-colors hover:underline"
          >
            {extractRepoName(sourceUrl)}
            <ExternalLink size={12} />
          </a>
        </StatCard>
      )}

      {/* Version */}
      <StatCard label="Version" icon={<Tag size={14} />}>
        <span className="font-mono text-sm text-sx-fg">{version}</span>
      </StatCard>

      {/* Category */}
      <StatCard label="Category" icon={null}>
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${getCategoryColor(category)}`}>
          {category}
        </span>
      </StatCard>

      {/* First Seen */}
      <StatCard label="First Seen" icon={<Calendar size={14} />}>
        <span className="font-mono text-sm text-sx-fg">
          {formatDate(createdAt)}
        </span>
      </StatCard>

      {/* Favorites */}
      <StatCard label="Favorites" icon={<Heart size={14} />}>
        <span className="font-mono text-sm text-sx-fg">
          {formatNumber(favoriteCount)}
        </span>
      </StatCard>

      {/* Model Usage (like "Installed on" from skills.sh) */}
      {modelBreakdown.length > 0 && (
        <StatCard label="Used By Models" icon={<Bot size={14} />}>
          <div className="space-y-1.5">
            {modelBreakdown.map((entry) => (
              <div key={entry.model} className="flex items-center justify-between text-sm">
                <span className="text-sx-fg-muted">{entry.model}</span>
                <span className="font-mono text-xs text-sx-fg">
                  {formatNumber(entry.count)}
                </span>
              </div>
            ))}
          </div>
        </StatCard>
      )}
    </aside>
  );
}

function StatCard({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="px-0 py-4 first:pt-0 last:pb-0">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-sx-fg-subtle">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getTier(score: number): string {
  if (score >= 9.0) return "S";
  if (score >= 7.5) return "A";
  if (score >= 6.0) return "B";
  return "C";
}

function getTierColor(score: number): string {
  const tier = getTier(score);
  const colors: Record<string, string> = {
    S: "text-tier-s",
    A: "text-tier-a",
    B: "text-tier-b",
    C: "text-tier-c",
  };
  return colors[tier] || "text-sx-fg-muted";
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    planning: "bg-phase-planning-bg text-phase-planning",
    implementation: "bg-phase-impl-bg text-phase-impl",
    testing: "bg-phase-testing-bg text-phase-testing",
    security: "bg-phase-security-bg text-phase-security",
    devops: "bg-phase-devops-bg text-phase-devops",
  };
  return colors[category.toLowerCase()] || "bg-sx-accent-muted text-sx-accent";
}

function extractRepoName(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : url;
  } catch {
    return url;
  }
}
