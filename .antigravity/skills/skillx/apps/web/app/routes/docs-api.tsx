import { PageContainer } from "~/components/layout/page-container";
import { DocsSubNav } from "~/components/docs/docs-sub-nav";
import { ApiEndpointCard } from "~/components/docs/api-endpoint-card";
import { SEARCH_ENDPOINTS, SKILL_ENDPOINTS } from "~/lib/docs/api-endpoints-data";
import { USER_ENDPOINTS, OTHER_ENDPOINTS } from "~/lib/docs/api-endpoints-user-admin-data";
import { Code, Key, Search, Star, BarChart3, Shield } from "lucide-react";
import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "API Reference — SkillX.sh" },
  { name: "description", content: "REST API reference for the SkillX marketplace." },
];

const TOC = [
  { id: "auth", label: "Authentication" },
  { id: "search", label: "Search" },
  { id: "skills", label: "Skills" },
  { id: "user", label: "User & Keys" },
  { id: "other", label: "Leaderboard & Admin" },
] as const;

export default function DocsApi() {
  return (
    <PageContainer>
      <DocsSubNav />

      <div className="mb-8">
        <h1 className="font-mono text-3xl font-bold">API Reference</h1>
        <p className="mt-2 text-sx-fg-muted">
          REST API for the SkillX marketplace. Base URL:{" "}
          <code className="rounded border border-sx-border bg-sx-bg-elevated px-1.5 py-0.5 font-mono text-xs text-sx-accent">
            https://skillx.sh
          </code>
        </p>
      </div>

      {/* Table of Contents */}
      <nav aria-label="Table of contents" className="mb-10 rounded-lg border border-sx-border bg-sx-bg-elevated p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-sx-fg-subtle">On this page</h2>
        <div className="flex flex-wrap gap-2">
          {TOC.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="rounded-md border border-sx-border px-3 py-1.5 font-mono text-xs text-sx-fg-muted transition-colors hover:border-sx-accent/30 hover:text-sx-accent"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      {/* Authentication */}
      <Section id="auth" icon={<Key size={22} />} title="Authentication">
        <div className="space-y-4">
          <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-5">
            <h3 className="mb-2 font-mono text-sm font-semibold">Session Cookie</h3>
            <p className="text-sm text-sx-fg-muted">
              Browser-based auth via Better Auth + GitHub OAuth. Session set automatically after login.
              Expires after 7 days, refreshes after 1 day of activity.
            </p>
          </div>
          <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-5">
            <h3 className="mb-2 font-mono text-sm font-semibold">API Key (Bearer Token)</h3>
            <p className="mb-3 text-sm text-sx-fg-muted">
              For CLI and external integrations. Format:{" "}
              <code className="text-sx-accent">sx_</code> prefix + 64 hex characters.
              Keys stored as SHA-256 hashes.
            </p>
            <div className="rounded-md border border-sx-border bg-sx-bg px-4 py-2 font-mono text-xs text-sx-fg-muted">
              Authorization: Bearer sx_&lt;64-hex-chars&gt;
            </div>
          </div>
          <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-5">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-sx-fg-subtle" />
              <h3 className="font-mono text-sm font-semibold">Error Format</h3>
            </div>
            <p className="mt-2 text-sm text-sx-fg-muted">
              All errors return <code className="text-sx-accent">{`{ "error": "message" }`}</code>.
              500 errors include an additional <code className="text-sx-accent">"details"</code> field.
            </p>
          </div>
        </div>
      </Section>

      {/* Search */}
      <Section id="search" icon={<Search size={22} />} title="Search">
        <div className="space-y-4">
          {SEARCH_ENDPOINTS.map((ep) => <ApiEndpointCard key={ep.id} {...ep} />)}
        </div>
      </Section>

      {/* Skills */}
      <Section id="skills" icon={<Star size={22} />} title="Skills">
        <div className="space-y-4">
          {SKILL_ENDPOINTS.map((ep) => <ApiEndpointCard key={ep.id} {...ep} />)}
        </div>
      </Section>

      {/* User & Keys */}
      <Section id="user" icon={<Code size={22} />} title="User & API Keys">
        <div className="space-y-4">
          {USER_ENDPOINTS.map((ep) => <ApiEndpointCard key={ep.id} {...ep} />)}
        </div>
      </Section>

      {/* Leaderboard & Admin */}
      <Section id="other" icon={<BarChart3 size={22} />} title="Leaderboard & Admin">
        <div className="space-y-4">
          {OTHER_ENDPOINTS.map((ep) => <ApiEndpointCard key={ep.id} {...ep} />)}
        </div>
      </Section>
    </PageContainer>
  );
}

function Section({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-12 scroll-mt-20">
      <div className="mb-6 flex items-center gap-3">
        <span className="text-sx-accent">{icon}</span>
        <h2 className="font-mono text-2xl font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
