import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface CommandBoxProps {
  command: string;
}

export function CommandBox({ command }: CommandBoxProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-sx-border bg-sx-bg-elevated px-4 py-3">
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className="text-sx-fg-subtle">$</span>
        <span className="text-sx-fg">{command}</span>
      </div>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 rounded p-1.5 text-sx-fg-muted transition-colors hover:bg-sx-bg-hover hover:text-sx-fg"
        aria-label="Copy command"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  );
}
