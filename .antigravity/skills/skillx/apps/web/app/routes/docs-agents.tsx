import { PageContainer } from "../components/layout/page-container";
import { DocsSubNav } from "../components/docs/docs-sub-nav";
import { CommandBox } from "../components/command-box";
import { Bot, Key, Zap } from "lucide-react";
import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Coding Agents Guide — SkillX.sh" },
  {
    name: "description",
    content:
      "Get started with SkillX on Claude Code, Codex, Gemini CLI, Cursor, Amp, Windsurf and more.",
  },
];

const AGENTS = [
  {
    name: "Claude Code",
    slug: "claude-code",
    install: "npx skills add nextlevelbuilder/skillx/skillx",
    envPath: ".claude/skillx/.env",
    configNote:
      "The skill auto-activates on every task via SKILL.md instructions.",
    docsUrl: "https://docs.anthropic.com/en/docs/claude-code",
  },
  {
    name: "Codex (OpenAI)",
    slug: "codex",
    install: null,
    manualSteps: [
      'Create an AGENTS.md file in your project root (or ~/.codex/)',
      'Add a reference to SkillX: include the skill content from skillx.sh',
    ],
    envPath: ".codex/.env",
    configNote: "Codex reads AGENTS.md for custom instructions at startup.",
    docsUrl: "https://github.com/openai/codex",
  },
  {
    name: "Gemini CLI",
    slug: "gemini-cli",
    install: null,
    manualSteps: [
      "Create .gemini/skills/skillx/ directory in your project",
      "Add SKILL.md with the skill content from skillx.sh",
    ],
    envPath: ".gemini/skillx/.env",
    configNote: "Gemini CLI loads skills from .gemini/skills/ automatically.",
    docsUrl: "https://github.com/google-gemini/gemini-cli",
  },
  {
    name: "Cursor",
    slug: "cursor",
    install: null,
    manualSteps: [
      "Open Cursor Settings > Rules",
      "Add a new project rule (.cursor/rules/skillx.mdc)",
      "Paste the skill content from skillx.sh",
    ],
    envPath: ".cursor/.env",
    configNote: "Cursor loads .mdc rule files from .cursor/rules/ on startup.",
    docsUrl: "https://docs.cursor.com",
  },
  {
    name: "Amp",
    slug: "amp",
    install: null,
    manualSteps: [
      "Create .amp/skills/skillx/ directory in your project",
      "Add SKILL.md with the skill content from skillx.sh",
    ],
    envPath: ".amp/skillx/.env",
    configNote: "Amp reads skill files from .amp/skills/ directory.",
    docsUrl: "https://ampcode.com",
  },
  {
    name: "Windsurf",
    slug: "windsurf",
    install: null,
    manualSteps: [
      "Create .windsurf/rules/skillx.md in your project",
      "Paste the skill content from skillx.sh",
    ],
    envPath: ".windsurf/.env",
    configNote: "Windsurf loads rules from .windsurf/rules/ on startup.",
    docsUrl: "https://docs.windsurf.com",
  },
] as const;

export default function DocsAgents() {
  return (
    <PageContainer>
      <DocsSubNav />

      <div className="mb-8">
        <h1 className="font-mono text-3xl font-bold">Coding Agents Guide</h1>
        <p className="mt-2 text-sx-fg-muted">
          Set up SkillX with your favorite AI coding agent in 3 steps.
        </p>
      </div>

      {/* Quick Start */}
      <section className="mb-12">
        <div className="mb-6 flex items-center gap-3">
          <Zap className="text-sx-accent" size={24} />
          <h2 className="font-mono text-2xl font-semibold">Quick Start</h2>
        </div>

        <div className="space-y-6">
          <QuickStep
            step={1}
            title="Install the SkillX skill"
            description="For Claude Code, run this in your project directory:"
          >
            <CommandBox command="npx skills add nextlevelbuilder/skillx/skillx" />
            <p className="mt-2 text-xs text-sx-fg-subtle">
              For other agents, see the agent-specific setup below.
            </p>
          </QuickStep>

          <QuickStep
            step={2}
            title="Get your API key"
            description="Generate a free API key from your SkillX settings page."
          >
            <a
              href="/settings"
              className="inline-flex items-center gap-2 rounded-lg border border-sx-accent/30 bg-sx-accent-muted px-4 py-2 font-mono text-sm text-sx-accent transition-colors hover:bg-sx-accent/20"
            >
              <Key size={16} />
              Get API Key →
            </a>
          </QuickStep>

          <QuickStep
            step={3}
            title="Add your API key"
            description="Create a .env file in the skill directory with your key."
          >
            <CommandBox command="echo 'SKILLX_API_KEY=sk_your_key_here' > .claude/skillx/.env" />
            <p className="mt-2 text-xs text-sx-fg-subtle">
              Adjust the path for your agent (see table below).
            </p>
          </QuickStep>
        </div>

        <div className="mt-6 rounded-lg border border-sx-accent/20 bg-sx-accent-muted/30 p-4">
          <p className="text-sm text-sx-fg-muted">
            <strong className="text-sx-accent">That's it!</strong> The SkillX
            skill will be invoked automatically during your coding sessions,
            giving your agent access to 133K+ skills from the marketplace.
          </p>
        </div>
      </section>

      {/* Agent-specific Setup */}
      <section className="mb-12">
        <div className="mb-6 flex items-center gap-3">
          <Bot className="text-sx-accent" size={24} />
          <h2 className="font-mono text-2xl font-semibold">
            Agent-Specific Setup
          </h2>
        </div>

        <div className="space-y-4">
          {AGENTS.map((agent) => (
            <AgentCard key={agent.slug} agent={agent} />
          ))}
        </div>
      </section>
    </PageContainer>
  );
}

function QuickStep({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-6">
      <h3 className="mb-2 font-mono text-lg font-medium">
        {step}. {title}
      </h3>
      <p className="mb-4 text-sm text-sx-fg-muted">{description}</p>
      {children}
    </div>
  );
}

function AgentCard({
  agent,
}: {
  agent: (typeof AGENTS)[number];
}) {
  return (
    <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-base font-semibold">{agent.name}</h3>
        <a
          href={agent.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-sx-fg-subtle hover:text-sx-accent"
        >
          docs →
        </a>
      </div>

      {agent.install ? (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-sx-fg-subtle">
            Install
          </p>
          <CommandBox command={agent.install} />
        </div>
      ) : (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-sx-fg-subtle">
            Manual Setup
          </p>
          <ol className="list-inside list-decimal space-y-1 text-sm text-sx-fg-muted">
            {"manualSteps" in agent &&
              agent.manualSteps?.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        </div>
      )}

      <div className="mb-2">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-sx-fg-subtle">
          API Key Location
        </p>
        <code className="rounded bg-sx-bg px-2 py-1 font-mono text-xs text-sx-accent">
          {agent.envPath}
        </code>
      </div>

      <p className="text-xs text-sx-fg-subtle">{agent.configNote}</p>
    </div>
  );
}
