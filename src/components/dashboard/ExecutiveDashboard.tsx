import { useState, useEffect } from 'react';
import { vfsService } from '../../lib/services/vfs.service';
import { PooledAccount, VFSNode } from '../../types';
import { TransferTask } from './StorageNodes';
import { FolderPlus, UploadCloud, Share2, CheckCircle2, ShieldCheck } from 'lucide-react';

interface ExecutiveDashboardProps {
  accounts: PooledAccount[];
  activeTransfers: TransferTask[];
  vfsNodes: VFSNode[];
  onUploadClick?: () => void;
  onNewFolderClick?: () => void;
  onSharedLinksClick?: () => void;
}

export function ExecutiveDashboard({ accounts, activeTransfers, vfsNodes, onUploadClick, onNewFolderClick, onSharedLinksClick }: ExecutiveDashboardProps) {
  const [localNodes, setLocalNodes] = useState<VFSNode[]>(vfsNodes);

  useEffect(() => {
    setLocalNodes(vfsNodes);
  }, [vfsNodes]);

  const totalQuota = accounts.reduce((sum, acc) => sum + (acc.totalQuota || 0), 0);
  
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  let totalBytes = 0;
  localNodes.forEach(node => {
    if (node.type === 'file') {
      totalBytes += node.size || 0;
    }
  });

  const pct = totalQuota > 0 ? (totalBytes / totalQuota) * 100 : 0;
  
  // Sort for recent activity
  const recentFiles = [...localNodes]
    .filter(n => n.type === 'file')
    .sort((a, b) => new Date(b.modifiedAt || b.createdAt).getTime() - new Date(a.modifiedAt || a.createdAt).getTime())
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-6 w-full animate-[fadeIn_0.4s_ease-out]">
      <h1 className="sr-only">Dashboard</h1>

      {/* Hero greeting */}
      <header>
        <h2 className="text-3xl md:text-4xl font-semibold text-zinc-100 leading-none tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Welcome back.
        </h2>
        <p className="mt-2 text-sm text-zinc-400 max-w-[60ch]">
          Your storage is active and synchronized. All files are end-to-end encrypted.
        </p>
      </header>

      {/* Bento grid */}
      <div className="grid grid-cols-12 gap-4 md:gap-6">

        {/* Storage Overview — large card */}
        <div className="col-span-12 lg:col-span-8 rounded-3xl bg-[#141432]/30 ring-1 ring-white/5 border border-[#1e1e5a]/30 p-6 md:p-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Current capacity</p>
              <p className="text-3xl md:text-4xl font-semibold text-zinc-100" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {formatSize(totalBytes)}{' '}
                <span className="text-zinc-600 text-xl md:text-2xl">/ {totalQuota > 0 ? formatSize(totalQuota) : 'Unlimited'}</span>
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-400 ring-1 ring-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connection verified
            </span>
          </div>

          <div className="mt-10 space-y-5">
            {/* Multi-segment progress bar */}
            <div className="flex h-3 gap-1 overflow-hidden rounded-full">
              <div className="w-1/2 bg-indigo-500" />
              <div className="w-1/6 bg-sky-400/80" />
              <div className="w-1/12 bg-amber-400/70" />
              <div className="flex-1 bg-[#1e1e5a]/60" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-2 text-zinc-400"><span className="size-2 rounded-full bg-indigo-500" />Media</div>
              <div className="flex items-center gap-2 text-zinc-400"><span className="size-2 rounded-full bg-sky-400/80" />Documents</div>
              <div className="flex items-center gap-2 text-zinc-400"><span className="size-2 rounded-full bg-amber-400/70" />Backups</div>
              <div className="flex items-center gap-2 text-zinc-500"><span className="size-2 rounded-full bg-[#1e1e5a]" />Free</div>
            </div>
            <p className="text-xs text-zinc-600 mt-1">{accounts.length} Connected Account(s) · {pct.toFixed(1)}% Used</p>
          </div>
        </div>

        {/* Right status cards */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="rounded-2xl bg-[#141432]/30 ring-1 ring-white/5 border border-[#1e1e5a]/30 p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-200">Encryption Active</p>
              <span className="size-2 rounded-full bg-emerald-400" />
            </div>
            <p className="mt-1 text-xs text-zinc-500">AES-256 end-to-end active for all storage.</p>
          </div>
          <div className="rounded-2xl bg-[#141432]/30 ring-1 ring-white/5 border border-[#1e1e5a]/30 p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-200">Shared Links</p>
            </div>
            <p className="mt-1 text-xs text-zinc-500">Manage public links &amp; expiry dates.</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="col-span-12 lg:col-span-4 rounded-2xl bg-[#141432]/30 ring-1 ring-white/5 border border-[#1e1e5a]/30 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-4">Quick actions</p>
          <div className="grid grid-cols-1 gap-2">
            <button onClick={onUploadClick} className="flex items-center gap-3 rounded-xl bg-[#0a0a1a]/60 border border-[#1e1e5a]/40 px-4 py-3 text-sm text-zinc-200 hover:border-indigo-500/40 transition-colors w-full text-left">
              <span className="grid size-8 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400">
                <UploadCloud className="w-4 h-4" />
              </span>
              Upload files
            </button>
            <button onClick={onNewFolderClick} className="flex items-center gap-3 rounded-xl bg-[#0a0a1a]/60 border border-[#1e1e5a]/40 px-4 py-3 text-sm text-zinc-200 hover:border-indigo-500/40 transition-colors w-full text-left">
              <span className="grid size-8 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400">
                <FolderPlus className="w-4 h-4" />
              </span>
              New folder
            </button>
            <button onClick={onSharedLinksClick} className="flex items-center gap-3 rounded-xl bg-[#0a0a1a]/60 border border-[#1e1e5a]/40 px-4 py-3 text-sm text-zinc-200 hover:border-indigo-500/40 transition-colors w-full text-left">
              <span className="grid size-8 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400">
                <Share2 className="w-4 h-4" />
              </span>
              Shared links
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="col-span-12 lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-zinc-200" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Recent activity</h3>
          </div>
          <div className="rounded-2xl bg-[#141432]/20 ring-1 ring-white/5 overflow-hidden">
            {recentFiles.length > 0 ? (
              <div className="divide-y divide-white/5">
                {recentFiles.map(file => (
                  <div key={file.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="grid size-9 place-items-center rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0 text-xs font-bold">
                        {file.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-200">{file.name}</p>
                        <p className="text-[11px] text-zinc-500">{formatSize(file.size || 0)}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-zinc-500">
                      {new Date(file.modifiedAt || file.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center">
                <p className="text-sm text-zinc-500">No recent activity. Upload files to see them here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
