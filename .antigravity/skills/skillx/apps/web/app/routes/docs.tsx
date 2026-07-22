import { PageContainer } from "../components/layout/page-container";
import { DocsSubNav } from "../components/docs/docs-sub-nav";
import { CommandBox } from "../components/command-box";
import { BookOpen, Terminal, Key, BarChart3, Settings, Search, Compass } from "lucide-react";
import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Docs — SkillX.sh" },
  { name: "description", content: "Getting started with SkillX CLI and available commands." },
];

export default function Docs() {
  return (
    <PageContainer>
      <DocsSubNav />

      <div className="mb-8">
        <h1 className="font-mono text-3xl font-bold">Documentation</h1>
        <p className="mt-2 text-sx-fg-muted">
          Everything you need to get started with SkillX.
        </p>
      </div>

      {/* Getting Started */}
      <section className="mb-12">
        <div className="mb-6 flex items-center gap-3">
          <BookOpen className="text-sx-accent" size={24} />
          <h2 className="font-mono text-2xl font-semibold">Getting Started</h2>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-6">
            <h3 className="mb-3 font-mono text-lg font-medium">1. Install the CLI</h3>
            <p className="mb-4 text-sm text-sx-fg-muted">
              Install SkillX globally or run it directly with npx.
            </p>
            <div className="space-y-3">
              <CommandBox command="npm install -g skillx-sh" />
              <p className="text-center text-xs text-sx-fg-subtle">or use without installing:</p>
              <CommandBox command="npx skillx-sh --help" />
            </div>
          </div>

          <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-6">
            <h3 className="mb-3 font-mono text-lg font-medium">2. Search for Skills</h3>
            <p className="mb-4 text-sm text-sx-fg-muted">
              Find skills using semantic search. SkillX understands natural language queries.
            </p>
            <CommandBox command='skillx search "deploy to cloudflare"' />
          </div>

          <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-6">
            <h3 className="mb-3 font-mono text-lg font-medium">3. Use a Skill</h3>
            <p className="mb-4 text-sm text-sx-fg-muted">
              View skill details and get the install command for your AI agent.
            </p>
            <CommandBox command="skillx use cloudflare-workers" />
          </div>

          <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-6">
            <h3 className="mb-3 font-mono text-lg font-medium">
              4. Configure API Key (Optional)
            </h3>
            <p className="mb-4 text-sm text-sx-fg-muted">
              Set up an API key to report usage stats and unlock authenticated features.
              Generate your key at{" "}
              <a href="/settings" className="text-sx-accent hover:underline">
                Settings
              </a>
              .
            </p>
            <CommandBox command="skillx config set-key" />
          </div>
        </div>
      </section>

      {/* Available Commands */}
      <section className="mb-12">
        <div className="mb-6 flex items-center gap-3">
          <Terminal className="text-sx-accent" size={24} />
          <h2 className="font-mono text-2xl font-semibold">Available Commands</h2>
        </div>

        <div className="space-y-4">
          <CommandEntry
            icon={<Search size={18} />}
            name="skillx search <query>"
            description="Search for skills in the marketplace using natural language. Results show name, category, rating, and description."
            example='skillx search "react authentication"'
          />

          <CommandEntry
            icon={<Terminal size={18} />}
            name="skillx use <identifier>"
            description="Smart skill lookup — supports author/skill, org/repo/skill, slug, or keyword search. Auto-registers from GitHub if not found."
            example="skillx use alinaqi/code-review"
            flags={[
              { flag: "-r, --raw", desc: "Output raw content only (for piping to files)" },
              { flag: "-s, --search", desc: "Force search mode regardless of identifier format" },
            ]}
          />

          <CommandEntry
            icon={<Compass size={18} />}
            name="skillx find <query>"
            description="Search and use a skill in one command. Shows numbered results and lets you pick one to view details."
            example='skillx find "deploy to cloudflare"'
          />

          <CommandEntry
            icon={<BarChart3 size={18} />}
            name="skillx report <slug> <outcome>"
            description="Report skill usage outcome. Requires an API key. Outcomes: success, failure, or partial."
            example="skillx report cloudflare-workers success --model claude-sonnet-4 --duration 1200"
            flags={[
              { flag: "-m, --model <model>", desc: "AI model used (e.g., claude-sonnet-4)" },
              { flag: "-d, --duration <ms>", desc: "Execution duration in milliseconds" },
            ]}
          />

          <CommandEntry
            icon={<Settings size={18} />}
            name="skillx config"
            description="Manage CLI configuration including API key and base URL."
            subcommands={[
              { name: "set-key", desc: "Set your SkillX API key interactively" },
              { name: "set-url <url>", desc: "Set custom API base URL (default: https://skillx.sh)" },
              { name: "show", desc: "Display current configuration" },
            ]}
          />

          <CommandEntry
            icon={<Key size={18} />}
            name="Environment Variables"
            description="You can also configure SkillX via environment variables."
            envVars={[
              { name: "SKILLX_API_KEY", desc: "API key (overrides config file)" },
              { name: "SKILLX_BASE_URL", desc: "Custom API base URL" },
            ]}
          />
        </div>
      </section>
    </PageContainer>
  );
}

function CommandEntry({
  icon,
  name,
  description,
  example,
  flags,
  subcommands,
  envVars,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  example?: string;
  flags?: { flag: string; desc: string }[];
  subcommands?: { name: string; desc: string }[];
  envVars?: { name: string; desc: string }[];
}) {
  return (
    <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-5">
      <div className="mb-2 flex items-center gap-2 text-sx-accent">{icon}</div>
      <h3 className="mb-1 font-mono text-sm font-semibold">{name}</h3>
      <p className="mb-3 text-sm text-sx-fg-muted">{description}</p>

      {flags && flags.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-sx-fg-subtle">
            Flags
          </p>
          <div className="space-y-1">
            {flags.map((f) => (
              <div key={f.flag} className="flex gap-3 text-sm">
                <code className="whitespace-nowrap font-mono text-sx-accent">{f.flag}</code>
                <span className="text-sx-fg-muted">{f.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {subcommands && subcommands.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-sx-fg-subtle">
            Subcommands
          </p>
          <div className="space-y-1">
            {subcommands.map((s) => (
              <div key={s.name} className="flex gap-3 text-sm">
                <code className="whitespace-nowrap font-mono text-sx-accent">{s.name}</code>
                <span className="text-sx-fg-muted">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {envVars && envVars.length > 0 && (
        <div className="mb-3">
          <div className="space-y-1">
            {envVars.map((v) => (
              <div key={v.name} className="flex gap-3 text-sm">
                <code className="whitespace-nowrap font-mono text-sx-accent">{v.name}</code>
                <span className="text-sx-fg-muted">{v.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {example && <CommandBox command={example} />}
    </div>
  );
}
