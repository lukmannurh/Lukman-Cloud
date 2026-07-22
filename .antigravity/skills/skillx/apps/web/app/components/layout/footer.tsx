import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="border-t border-sx-border py-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-sx-fg-subtle sm:flex-row sm:px-6 lg:px-8">
        <div className="font-mono font-medium">
          SKILL<span className="text-sx-accent">X</span>.sh
        </div>

        <div className="flex gap-6">
          <a
            href="https://github.com/skillx-sh"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-sx-fg"
          >
            GitHub
          </a>
          <Link to="/docs" className="transition-colors hover:text-sx-fg">
            Docs
          </Link>
        </div>

        <div className="text-xs">
          © {new Date().getFullYear()} SkillX.sh
        </div>
      </div>
    </footer>
  );
}
