import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { PageContainer } from "../components/layout/page-container";
import { Key, Plus, Trash2 } from "lucide-react";
import { getSession } from "~/lib/auth/session-helpers";
import { getDb } from "~/lib/db";
import { apiKeys } from "~/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { useEffect, useState } from "react";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env as Env;
  const session = await getSession(request, env);

  if (!session?.user?.id) {
    return { isAuthenticated: false, keys: [] };
  }

  const db = getDb(env.DB);

  // Fetch user's API keys
  const userKeys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      key_prefix: apiKeys.key_prefix,
      last_used_at: apiKeys.last_used_at,
      created_at: apiKeys.created_at,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.user_id, session.user.id), isNull(apiKeys.revoked_at)))
    .orderBy(apiKeys.created_at);

  return {
    isAuthenticated: true,
    keys: userKeys.map((key) => ({
      ...key,
      key_masked: `${key.key_prefix}...`,
    })),
  };
}

export default function Settings() {
  const data = useLoaderData<typeof loader>();
  const createFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const [newKeyName, setNewKeyName] = useState("");
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  if (!data.isAuthenticated) {
    return (
      <PageContainer>
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-8 text-center">
            <Key className="mx-auto mb-4 text-sx-fg-muted" size={48} />
            <h2 className="mb-2 font-mono text-xl font-bold">Login Required</h2>
            <p className="text-sx-fg-muted">
              Please log in to manage your API keys.
            </p>
          </div>
        </div>
      </PageContainer>
    );
  }

  const handleGenerateKey = () => {
    if (!newKeyName.trim()) {
      alert("Please enter a name for the API key");
      return;
    }

    createFetcher.submit(
      { name: newKeyName.trim() },
      {
        method: "post",
        action: "/api/user/api-keys",
        encType: "application/json",
      }
    );

    setNewKeyName("");
    setShowNewKeyModal(false);
  };

  // Show generated key when fetcher returns a new one
  useEffect(() => {
    if (createFetcher.data?.key) {
      setGeneratedKey(createFetcher.data.key);
    }
  }, [createFetcher.data]);

  const handleDeleteKey = (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key?")) return;

    deleteFetcher.submit(
      { id: keyId },
      {
        method: "delete",
        action: "/api/user/api-keys",
        encType: "application/json",
      }
    );
  };

  const formatDate = (timestamp: number | string | Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(timestamp));
  };

  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="font-mono text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-sx-fg-muted">Manage your API keys.</p>
      </div>

      {/* Generated Key Modal */}
      {generatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-lg border border-sx-border bg-sx-bg p-6">
            <h3 className="mb-4 font-mono text-lg font-semibold">
              API Key Generated
            </h3>
            <p className="mb-4 text-sm text-sx-fg-muted">
              Copy this key now. It will not be shown again.
            </p>
            <div className="mb-6 break-all rounded-lg bg-sx-bg-elevated p-4 font-mono text-sm">
              {generatedKey}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedKey);
                setGeneratedKey(null);
              }}
              className="w-full rounded-lg bg-sx-accent px-4 py-2 font-medium text-sx-bg transition-colors hover:bg-sx-accent-hover"
            >
              Copy & Close
            </button>
          </div>
        </div>
      )}

      {/* New Key Modal */}
      {showNewKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border border-sx-border bg-sx-bg p-6">
            <h3 className="mb-4 font-mono text-lg font-semibold">
              Generate New API Key
            </h3>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g., Production CLI)"
              className="mb-4 w-full rounded-lg border border-sx-border bg-sx-bg-elevated px-4 py-2 text-sx-fg"
            />
            <div className="flex gap-2">
              <button
                onClick={handleGenerateKey}
                disabled={!newKeyName.trim()}
                className="flex-1 rounded-lg bg-sx-accent px-4 py-2 font-medium text-sx-bg transition-colors hover:bg-sx-accent-hover disabled:opacity-50"
              >
                Generate
              </button>
              <button
                onClick={() => {
                  setShowNewKeyModal(false);
                  setNewKeyName("");
                }}
                className="flex-1 rounded-lg border border-sx-border px-4 py-2 font-medium transition-colors hover:bg-sx-bg-hover"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Keys Section */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono text-lg font-semibold">API Keys</h2>
          <button
            onClick={() => setShowNewKeyModal(true)}
            className="flex items-center gap-2 rounded-lg bg-sx-accent px-4 py-2 text-sm font-medium text-sx-bg transition-colors hover:bg-sx-accent-hover"
          >
            <Plus size={16} />
            Generate New Key
          </button>
        </div>

        {/* API Keys Table */}
        <div className="overflow-hidden rounded-lg border border-sx-border">
          <table className="w-full">
            <thead className="bg-sx-bg-elevated">
              <tr className="border-b border-sx-border">
                <th className="px-4 py-3 text-left font-mono text-xs uppercase tracking-wide text-sx-fg-muted">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-mono text-xs uppercase tracking-wide text-sx-fg-muted">
                  Key
                </th>
                <th className="px-4 py-3 text-left font-mono text-xs uppercase tracking-wide text-sx-fg-muted">
                  Created
                </th>
                <th className="px-4 py-3 text-right font-mono text-xs uppercase tracking-wide text-sx-fg-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {data.keys.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sx-fg-muted">
                    No API keys yet. Generate one to get started.
                  </td>
                </tr>
              ) : (
                data.keys.map((key) => (
                  <tr key={key.id} className="border-b border-sx-border last:border-0">
                    <td className="px-4 py-3 font-medium">{key.name}</td>
                    <td className="px-4 py-3 font-mono text-sm text-sx-fg-muted">
                      {key.key_masked}
                    </td>
                    <td className="px-4 py-3 text-sm text-sx-fg-muted">
                      {formatDate(key.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 size={14} />
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}
