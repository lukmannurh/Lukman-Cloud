import { useState, useEffect } from 'react';
import { vfsService } from '../../lib/services/vfs.service';
import { PooledAccount, VFSNode } from '../../types';
import { TransferTask } from './StorageNodes';
import { FolderPlus, UploadCloud, Share2, CheckCircle2, ShieldCheck, Upload, Folder } from 'lucide-react';
import { calculateStorageBreakdown, calculateTotalStorage } from '../../lib/file-categories';

interface ExecutiveDashboardProps {
  accounts?: PooledAccount[];
  activeTransfers?: TransferTask[];
  vfsNodes?: VFSNode[];
  onUploadClick?: () => void;
  onUploadFolderClick?: () => void;
  onNewFolderClick?: () => void;
  onSharedLinksClick?: () => void;
  onNavigateToFile?: (parentId: string, fileId: string) => void;
}

export function ExecutiveDashboard({ 
  accounts = [], 
  activeTransfers = [], 
  vfsNodes = [], 
  onUploadClick = () => {}, 
  onUploadFolderClick = () => {}, 
  onNewFolderClick = () => {}, 
  onSharedLinksClick = () => {}, 
  onNavigateToFile = () => {} 
}: ExecutiveDashboardProps) {
  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  const safeNodes = Array.isArray(vfsNodes) ? vfsNodes : [];
  const [localNodes, setLocalNodes] = useState<VFSNode[]>(safeNodes);

  useEffect(() => {
    setLocalNodes(Array.isArray(vfsNodes) ? vfsNodes : []);
  }, [vfsNodes]);

  const totalQuota = safeAccounts.reduce((sum, acc) => sum + (acc?.totalQuota || 0), 0);
  
  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const categories = calculateStorageBreakdown(localNodes);
  const totalBytes = categories.total;

  const getPct = (val: number) => totalBytes > 0 ? (val / totalBytes) * 100 : 0;
  const freeBytes = Math.max(0, totalQuota - totalBytes);
  const freePct = totalQuota > 0 ? (freeBytes / totalQuota) * 100 : 0;
  const pct = totalQuota > 0 ? (totalBytes / totalQuota) * 100 : 0;
  
  // Sort for recent activity
  const recentFiles = [...(localNodes || [])]
    .filter(n => n && n.type === 'file')
    .sort((a, b) => new Date(b.modifiedAt || b.createdAt || 0).getTime() - new Date(a.modifiedAt || a.createdAt || 0).getTime())
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
          Overview of your files, storage capacity, and recent activity.
        </p>
      </header>

      {/* Bento grid */}
      <div className="grid grid-cols-12 gap-4 md:gap-6 auto-rows-[1fr]">

        {/* Storage Overview — large card */}
        <div className="col-span-12 lg:col-span-8 rounded-3xl bg-[#141432]/30 ring-1 ring-white/5 border border-[#1e1e5a]/30 p-6 md:p-8 flex flex-col h-full">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">Current capacity</p>
              <p className="text-3xl md:text-4xl font-semibold text-zinc-100" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {formatSize(totalBytes)}{' '}
                <span className="text-zinc-600 text-xl md:text-2xl">/ {totalQuota > 0 ? formatSize(totalQuota) : 'Unlimited'}</span>
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-400 ring-1 ring-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Storage Active
            </span>
          </div>

          <div className="mt-auto pt-10 space-y-5">
            {/* Multi-segment progress bar */}
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
              {totalBytes === 0 ? (
                <div className="w-full bg-[#1e1e5a]/60" />
              ) : (
                <>
                  <div style={{ width: `${getPct(categories.images)}%` }} className="transition-all duration-700 bg-indigo-500" />
                  <div style={{ width: `${getPct(categories.videos)}%` }} className="transition-all duration-700 bg-sky-400/80" />
                  <div style={{ width: `${getPct(categories.documents)}%` }} className="transition-all duration-700 bg-emerald-400/80" />
                  <div style={{ width: `${getPct(categories.other)}%` }} className="transition-all duration-700 bg-rose-400/70" />
                  {totalQuota > 0 && <div style={{ width: `${freePct}%` }} className="bg-[#1e1e5a]/60 flex-1" />}
                </>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full mt-4">
              {[
                { label: 'Images', size: categories.images, color: 'bg-indigo-500' },
                { label: 'Videos', size: categories.videos, color: 'bg-sky-400/80' },
                { label: 'Documents', size: categories.documents, color: 'bg-emerald-400/80' },
                { label: 'Other', size: categories.other, color: 'bg-rose-400/70' },
              ].map(({ label, size, color }) => (
                <div key={label} className="flex flex-col gap-1 p-2.5 bg-[#0a0a1a]/50 rounded-xl border border-[#1e1e5a]/40 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                    <span className={`shrink-0 w-2 h-2 rounded-full ${color}`} />
                    {label}
                  </div>
                  <div className="text-sm font-semibold text-zinc-100">
                    {formatSize(size)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="col-span-12 lg:col-span-4 rounded-3xl bg-[#141432]/30 ring-1 ring-white/5 border border-[#1e1e5a]/30 p-6 flex flex-col h-full">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-4">Quick actions</p>
          <div className="grid grid-cols-2 gap-3 flex-1">
            <button onClick={onUploadClick} className="p-3.5 bg-[#0a0a1a]/60 hover:bg-[#0a0a1a] rounded-xl border border-[#1e1e5a]/40 hover:border-indigo-500/50 transition-all flex flex-col justify-between text-left group focus:ring-2 focus:ring-indigo-500 focus:outline-none">
              <span className="grid size-8 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400 group-hover:bg-indigo-500/25 transition-colors mb-2">
                <Upload className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate whitespace-nowrap">Upload Files</p>
                <p className="text-[10px] text-zinc-500 mt-0.5 truncate">Select files to upload</p>
              </div>
            </button>
            <button onClick={onUploadFolderClick || onUploadClick} className="p-3.5 bg-[#0a0a1a]/60 hover:bg-[#0a0a1a] rounded-xl border border-[#1e1e5a]/40 hover:border-indigo-500/50 transition-all flex flex-col justify-between text-left group focus:ring-2 focus:ring-indigo-500 focus:outline-none">
              <span className="grid size-8 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400 group-hover:bg-indigo-500/25 transition-colors mb-2">
                <FolderPlus className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate whitespace-nowrap">Upload Folder</p>
                <p className="text-[10px] text-zinc-500 mt-0.5 truncate">Batch directory upload</p>
              </div>
            </button>
            <button onClick={onNewFolderClick} className="p-3.5 bg-[#0a0a1a]/60 hover:bg-[#0a0a1a] rounded-xl border border-[#1e1e5a]/40 hover:border-indigo-500/50 transition-all flex flex-col justify-between text-left group focus:ring-2 focus:ring-indigo-500 focus:outline-none">
              <span className="grid size-8 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400 group-hover:bg-indigo-500/25 transition-colors mb-2">
                <Folder className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate whitespace-nowrap">New Folder</p>
                <p className="text-[10px] text-zinc-500 mt-0.5 truncate">Create directory</p>
              </div>
            </button>
            <button onClick={onSharedLinksClick} className="p-3.5 bg-[#0a0a1a]/60 hover:bg-[#0a0a1a] rounded-xl border border-[#1e1e5a]/40 hover:border-indigo-500/50 transition-all flex flex-col justify-between text-left group focus:ring-2 focus:ring-indigo-500 focus:outline-none">
              <span className="grid size-8 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400 group-hover:bg-indigo-500/25 transition-colors mb-2">
                <Share2 className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate whitespace-nowrap">Shared Links</p>
                <p className="text-[10px] text-zinc-500 mt-0.5 truncate">Manage public access</p>
              </div>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="col-span-12 lg:col-span-8 rounded-3xl bg-[#141432]/30 ring-1 ring-white/5 border border-[#1e1e5a]/30 p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-zinc-200" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Recent activity</h3>
          </div>
          <div className="rounded-2xl bg-[#141432]/20 ring-1 ring-white/5 overflow-hidden">
            {recentFiles.length > 0 ? (
              <div className="divide-y divide-white/5">
                {recentFiles.map(file => (
                  <div key={file.id} 
                    className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => onNavigateToFile?.(file.parentId || 'root', file.id)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="grid size-9 place-items-center rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0 text-xs font-bold">
                        {file.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-200">{file.name}</p>
                        <p className="text-[11px] text-zinc-400">{formatSize(file.size || 0)}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-zinc-400">
                      {new Date(file.modifiedAt || file.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center">
                <p className="text-sm text-zinc-400">No recent activity. Upload files to see them here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
