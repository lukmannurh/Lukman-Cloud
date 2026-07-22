import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { RatingBadge } from "./rating-badge";

interface SkillCardProps {
  slug: string;
  name: string;
  author: string;
  description: string;
  category: string;
  installs: number;
  rating: number;
}

export function SkillCard({
  slug,
  name,
  author,
  description,
  category,
  installs,
  rating,
}: SkillCardProps) {
  const [copied, setCopied] = useState(false);
  const installCommand = `npx skillx-sh use ${slug}`;

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Link
      to={`/skills/${slug}`}
      className="block rounded-lg border border-sx-border bg-sx-bg-elevated p-4 transition-all hover:-translate-y-0.5 hover:border-sx-border-hover"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sx-fg">{name}</h3>
          <p className="mt-0.5 text-xs text-sx-fg-muted">by {author}</p>
        </div>
        <RatingBadge score={rating} />
      </div>

      {/* Description */}
      <p className="mt-3 line-clamp-2 text-sm text-sx-fg-muted">
        {description}
      </p>

      {/* Tags */}
      <div className="mt-3 flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getCategoryColor(category)}`}>
          {category}
        </span>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-sx-border pt-3">
        <div className="text-xs text-sx-fg-subtle">
          {formatNumber(installs)} installs
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-sx-fg-muted transition-colors hover:bg-sx-bg-hover hover:text-sx-fg"
          aria-label="Copy install command"
        >
          {copied ? (
            <>
              <Check size={12} />
              Copied
            </>
          ) : (
            <>
              <Copy size={12} />
              Install
            </>
          )}
        </button>
      </div>
    </Link>
  );
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

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}
