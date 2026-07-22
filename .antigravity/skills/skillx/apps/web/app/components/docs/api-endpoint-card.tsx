import { Check, Copy } from "lucide-react";
import { useState } from "react";

export interface EndpointParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: string;
}

export interface EndpointError {
  status: number;
  body: string;
  cause: string;
}

export interface EndpointProps {
  id: string;
  method: "GET" | "POST" | "DELETE";
  path: string;
  auth: string;
  description: string;
  params?: EndpointParam[];
  requestExample?: string;
  responseExample: string;
  errors?: EndpointError[];
  notes?: string[];
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function ApiEndpointCard(props: EndpointProps) {
  const { id, method, path, auth, description, params, requestExample, responseExample, errors, notes } = props;

  return (
    <div id={id} className="scroll-mt-20 rounded-lg border border-sx-border bg-sx-bg-elevated p-6">
      {/* Header: method badge + path */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className={`rounded border px-2 py-0.5 font-mono text-xs font-bold ${METHOD_COLORS[method]}`}>
          {method}
        </span>
        <code className="font-mono text-sm text-sx-fg">{path}</code>
        <span className="ml-auto text-xs text-sx-fg-subtle">Auth: {auth}</span>
      </div>

      <p className="mb-4 text-sm text-sx-fg-muted">{description}</p>

      {/* Params table */}
      {params && params.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sx-fg-subtle">Parameters</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sx-border text-left text-xs text-sx-fg-subtle">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Required</th>
                  <th className="pb-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {params.map((p) => (
                  <tr key={p.name} className="border-b border-sx-border/50">
                    <td className="py-2 pr-4 font-mono text-xs text-sx-accent">{p.name}</td>
                    <td className="py-2 pr-4 text-sx-fg-muted">{p.type}</td>
                    <td className="py-2 pr-4">{p.required ? <span className="text-sx-warning">Yes</span> : <span className="text-sx-fg-subtle">No{p.default ? ` (${p.default})` : ""}</span>}</td>
                    <td className="py-2 text-sx-fg-muted">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request example */}
      {requestExample && (
        <div className="mb-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sx-fg-subtle">Request Body</h4>
          <CodeBlock content={requestExample} />
        </div>
      )}

      {/* Response example */}
      <div className="mb-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sx-fg-subtle">Response</h4>
        <CodeBlock content={responseExample} />
      </div>

      {/* Notes */}
      {notes && notes.length > 0 && (
        <div className="mb-4">
          <ul className="list-inside list-disc space-y-1 text-xs text-sx-fg-muted">
            {notes.map((note, i) => <li key={i}>{note}</li>)}
          </ul>
        </div>
      )}

      {/* Errors */}
      {errors && errors.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sx-fg-subtle">Errors</h4>
          <div className="space-y-1">
            {errors.map((e) => (
              <div key={`${e.status}-${e.cause}`} className="flex gap-3 text-xs">
                <span className="w-8 shrink-0 font-mono text-sx-error">{e.status}</span>
                <span className="text-sx-fg-muted">{e.cause}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CodeBlock({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (non-HTTPS or permission denied)
    }
  };

  return (
    <div className="group relative rounded-md border border-sx-border bg-sx-bg p-4">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 rounded p-1 text-sx-fg-subtle opacity-0 transition-opacity hover:text-sx-fg group-hover:opacity-100"
        aria-label="Copy"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-sx-fg-muted">
        {content}
      </pre>
    </div>
  );
}
