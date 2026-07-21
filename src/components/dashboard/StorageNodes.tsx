import { useState, useEffect } from 'react';
import { PooledAccount, VFSNode } from '../../types';
import { FileStack, ShieldCheck, RefreshCw } from 'lucide-react';
import logoAsset from '../../assets/logo.webp';
import { supabase } from '../../lib/services/supabaseClient';

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

  let imageBytes = 0;
  let docBytes = 0;
  let videoBytes = 0;
  let systemBytes = 0;

  (vfsNodes || []).forEach(node => {
    if (node.type === 'file') {
      const ext = node.name.split('.').pop()?.toLowerCase() || '';
      const size = node.size || 0;
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
        imageBytes += size;
      } else if (['pdf', 'docx', 'txt', 'xlsx', 'csv'].includes(ext)) {
        docBytes += size;
      } else if (['mp4', 'mkv', 'webm', 'avi', 'mov'].includes(ext)) {
        videoBytes += size;
      } else {
        systemBytes += size;
      }
    }
  });

  const totalComputed = imageBytes + docBytes + videoBytes + systemBytes;
  const imagePct = totalComputed > 0 ? (imageBytes / totalComputed) * 100 : 0;
  const docPct = totalComputed > 0 ? (docBytes / totalComputed) * 100 : 0;
  const videoPct = totalComputed > 0 ? (videoBytes / totalComputed) * 100 : 0;
  const systemPct = totalComputed > 0 ? (systemBytes / totalComputed) * 100 : 0;

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
            <p className="text-[11px] text-zinc-500">Secure pool</p>
          </div>

          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
            <div className="transition-all duration-700 bg-indigo-500" style={{ width: `${Math.max(1, imagePct)}%` }} />
            <div className="transition-all duration-700 bg-sky-400/80" style={{ width: `${Math.max(1, docPct)}%` }} />
            <div className="transition-all duration-700 bg-amber-400/70" style={{ width: `${Math.max(1, videoPct)}%` }} />
            <div className="flex-1 bg-[#1e1e5a]/60" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              { label: 'Images', size: imageBytes, color: 'bg-indigo-500' },
              { label: 'Documents', size: docBytes, color: 'bg-sky-400/80' },
              { label: 'Videos', size: videoBytes, color: 'bg-amber-400/70' },
              { label: 'Other Data', size: systemBytes, color: 'bg-zinc-500/70' },
            ].map(({ label, size, color }) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-[#0a0a1a]/60 border border-[#1e1e5a]/40 px-3 py-2">
                <span className="flex items-center gap-2 text-zinc-400">
                  <span className={`size-2 rounded-full ${color}`} />
                  {label}
                </span>
                <span className="text-zinc-200">{formatSize(size)}</span>
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
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
            </div>
            <p className="mt-3 text-2xl font-semibold text-zinc-100" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
            <p className="text-xs text-zinc-500">{sub}</p>
          </div>
        ))}
      </section>

      {/* Connected accounts */}
      <section className="rounded-3xl bg-[#141432]/20 ring-1 ring-white/5 border border-[#1e1e5a]/30 p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Connected accounts</h3>
            <p className="text-sm text-zinc-500">Add a cloud account to expand your storage pool.</p>
          </div>
          <button
            onClick={onAddAccount}
            className="inline-flex items-center gap-2 rounded-lg border border-[#1e1e5a]/60 bg-[#141432]/60 px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-[#141432] transition-colors"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Add account
          </button>
        </div>

        <div className="space-y-3">
          {accounts.length === 0 ? (
            <button
              onClick={onAddAccount}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[#1e1e5a] px-4 py-6 text-sm text-zinc-500 hover:border-indigo-500/50 hover:text-indigo-300 transition-colors"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              Link a storage account
            </button>
          ) : (
            accounts.map(acc => {
              const pct = acc.totalQuota > 0 ? Math.min(100, Math.round((acc.usedQuota / acc.totalQuota) * 100)) : 0;
              return (
                <div key={acc.id} className="flex items-center justify-between rounded-2xl bg-[#0a0a1a]/50 ring-1 ring-white/5 border border-[#1e1e5a]/30 p-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="grid size-10 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10 text-zinc-200 text-xs font-semibold">
                      {acc.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-100">{acc.email}</p>
                      <p className="text-[11px] text-zinc-500">{formatSize(acc.usedQuota)} / {acc.totalQuota > 0 ? formatSize(acc.totalQuota) : 'Unlimited'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer">Manage</span>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Active Transfers */}
      {activeTransfers.length > 0 && (
        <section className="rounded-2xl bg-[#141432]/20 ring-1 ring-white/5 border border-[#1e1e5a]/30 p-6">
          <h3 className="text-sm font-medium text-zinc-200 mb-4">Active Operations</h3>
          <div className="flex flex-col gap-3">
            {activeTransfers.map(tx => (
              <div key={tx.id} className="bg-[#0a0a1a]/50 p-4 border border-[#1e1e5a]/40 rounded-xl">
                <div className="flex justify-between text-xs font-medium text-zinc-300 mb-1.5 truncate">
                  <span className="truncate max-w-[220px]">{tx.name}</span>
                  <span className="text-zinc-500 shrink-0 ml-2">
                    {tx.progress !== undefined ? `${Math.round(tx.progress)}%` : '…'}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 mb-2.5">{tx.status}</div>
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
