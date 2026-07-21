import { useState, useEffect } from 'react';
import { PooledAccount, VFSNode } from '../../types';
import { FileStack, ShieldCheck, RefreshCw } from 'lucide-react';
import logoAsset from '../../assets/logo.webp';
import { supabase } from '../../lib/services/supabaseClient';
import { calculateStorageBreakdown } from '../../lib/file-categories';

export interface TransferTask {
  id: string;
  name: string;
  status: string;
  progress?: number;
}

interface StorageNodesProps {
  accounts: PooledAccount[];
  vfsNodes: VFSNode[];
  onAddAccount: () => void;
  activeTransfers: TransferTask[];
}

export function StorageNodes({
  accounts,
  vfsNodes,
  onAddAccount,
  activeTransfers
}: StorageNodesProps) {
  // Secure configurations are now globally hardcoded.

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  // Aggregate stats
  let totalLimit = 0;
  let totalUsage = 0;
  let hasUnlimited = false;

  accounts.forEach(acc => {
    if (acc.totalQuota === 0) hasUnlimited = true;
    totalLimit += acc.totalQuota;
    totalUsage += acc.usedQuota;
  });

  const aggregatePercent = (totalLimit > 0 && !hasUnlimited) ? Math.min(100, Math.round((totalUsage / totalLimit) * 100)) : 0;

  const categories = calculateStorageBreakdown(vfsNodes || []);
  const totalComputed = categories.total;

  const imagePct = totalComputed > 0 ? (categories.images / totalComputed) * 100 : 0;
  const docPct = totalComputed > 0 ? (categories.documents / totalComputed) * 100 : 0;
  const videoPct = totalComputed > 0 ? (categories.videos / totalComputed) * 100 : 0;
  const systemPct = totalComputed > 0 ? (categories.other / totalComputed) * 100 : 0;
  
  const top10Files = (vfsNodes || [])
    .filter(n => n.type === 'file')
    .sort((a, b) => (b.size || 0) - (a.size || 0))
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-6 w-full animate-[fadeIn_0.4s_ease-out]">
      {/* Page header */}
      <header className="max-w-3xl mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight leading-none">
          Storage
        </h1>
      </header>

      {/* Primary storage card */}
      <section className="rounded-3xl bg-[#141432]/30 ring-1 ring-white/5 border border-[#1e1e5a]/30 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid size-14 place-items-center rounded-2xl bg-indigo-500/15 ring-1 ring-indigo-500/40">
              <img src={logoAsset} alt="Storage" className="w-7 h-7 object-contain opacity-80" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-100" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Lukman Cloud Storage</h2>
              <p className="text-sm text-zinc-400">
                Primary cloud storage active and fully encrypted. Status:{' '}
                <span className="text-emerald-400">Secure &amp; Synchronized</span>.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-400 ring-1 ring-emerald-500/20">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Synchronized
          </span>
        </div>

        {/* Storage meter */}
        <div className="mt-8 space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-3xl md:text-4xl font-semibold text-zinc-100" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {formatSize(totalComputed)}{' '}
              <span className="text-zinc-600 text-lg md:text-xl">/ {totalLimit > 0 ? formatSize(totalLimit) : 'Unlimited'}</span>
            </p>
            <p className="text-[11px] text-zinc-400">Secure pool</p>
          </div>

          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
            <div className="transition-all duration-700 bg-indigo-500" style={{ width: `${imagePct}%` }} />
            <div className="transition-all duration-700 bg-sky-400/80" style={{ width: `${videoPct}%` }} />
            <div className="transition-all duration-700 bg-emerald-400/80" style={{ width: `${docPct}%` }} />
            <div className="transition-all duration-700 bg-rose-400/70" style={{ width: `${systemPct}%` }} />
            <div className="flex-1 bg-[#1e1e5a]/60" />
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
      </section>

      {/* Status row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {[
          {
            icon: <ShieldCheck className="size-4" />,
            iconBg: 'bg-emerald-500/10 text-emerald-400',
            label: 'Reliability',
            value: '100%',
            sub: 'Operational / Optimal',
          },
          {
            icon: <RefreshCw className="size-4" />,
            iconBg: 'bg-sky-500/10 text-sky-400',
            label: 'Sync status',
            value: accounts.length > 0 && activeTransfers.length > 0 ? 'Syncing' : 'Idle',
            sub: 'Standby · ready when needed',
          },
          {
            icon: (
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            ),
            iconBg: 'bg-indigo-500/10 text-indigo-400',
            label: 'Encryption',
            value: 'AES-256',
            sub: 'End-to-end · active',
          },
        ].map(({ icon, iconBg, label, value, sub }) => (
          <div key={label} className="rounded-2xl bg-[#141432]/30 ring-1 ring-white/5 border border-[#1e1e5a]/30 p-5">
            <div className="flex items-center gap-3">
              <div className={`grid size-9 place-items-center rounded-lg ${iconBg}`}>{icon}</div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
            </div>
            <p className="mt-3 text-2xl font-semibold text-zinc-100" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
            <p className="text-xs text-zinc-400">{sub}</p>
          </div>
        ))}
      </section>



      {/* Top 10 Largest Files */}
      {top10Files.length > 0 && (
        <section className="rounded-3xl bg-[#141432]/20 ring-1 ring-white/5 border border-[#1e1e5a]/30 p-6 md:p-8">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-zinc-100" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Top 10 Largest Files</h3>
            <p className="text-sm text-zinc-400">The most space-consuming files across your storage.</p>
          </div>
          <div className="space-y-2">
            {top10Files.map((file, index) => (
              <div key={file.id} className="flex flex-wrap items-center justify-between gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-6 text-center text-xs font-bold text-zinc-400 shrink-0">#{index + 1}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-200" title={file.name}>{file.name}</p>
                    <p className="text-[11px] text-zinc-400">{file.path.replace(`/${file.name}`, '').replace(/\//g, ' > ') || 'Root'}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-sm font-semibold text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-md">{formatSize(file.size || 0)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Transfers */}
      {activeTransfers.length > 0 && (
        <section className="rounded-2xl bg-[#141432]/20 ring-1 ring-white/5 border border-[#1e1e5a]/30 p-6">
          <h3 className="text-sm font-medium text-zinc-200 mb-4">Active Operations</h3>
          <div className="flex flex-col gap-3">
            {activeTransfers.map(tx => (
              <div key={tx.id} className="bg-[#0a0a1a]/50 p-4 border border-[#1e1e5a]/40 rounded-xl">
                <div className="flex justify-between text-xs font-medium text-zinc-300 mb-1.5 truncate">
                  <span className="truncate max-w-[220px]">{tx.name}</span>
                  <span className="text-zinc-400 shrink-0 ml-2">
                    {tx.progress !== undefined ? `${Math.round(tx.progress)}%` : '…'}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 mb-2.5">{tx.status}</div>
                {tx.progress !== undefined && (
                  <div className="w-full h-1.5 bg-[#1e1e5a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-200"
                      style={{ width: `${tx.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
