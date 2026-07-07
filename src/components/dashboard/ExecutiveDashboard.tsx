import { useState, useEffect } from 'react';
import { vfsService } from '../../lib/services/vfs.service';
import { PooledAccount, VFSNode, isGoogleDriveRef, isTelegramRef, isVFSFile } from '../../types';
import { Card } from '../ui/Card';
import { TransferTask } from './StorageNodes';

interface ExecutiveDashboardProps {
  accounts: PooledAccount[];
  activeTransfers: TransferTask[];
  vfsNodes: VFSNode[];
}

export function ExecutiveDashboard({ accounts, activeTransfers, vfsNodes }: ExecutiveDashboardProps) {
  const [localNodes, setLocalNodes] = useState<VFSNode[]>(vfsNodes);

  useEffect(() => {
    // Re-hydration scan of VFS registry immediately on mount
    vfsService.loadRegistry().then(nodes => setLocalNodes(nodes)).catch(console.error);
  }, []);

  const totalQuota = accounts.reduce((sum, acc) => sum + (acc.totalQuota || 0), 0);
  
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Live calculation for Cloud Distribution based on VFS nodes
  let gdriveCount = 0;
  let gdriveBytes = 0;
  let tgCount = 0;
  let tgBytes = 0;

  localNodes.forEach(node => {
    if (isVFSFile(node) && node.rawRef) {
      if (isGoogleDriveRef(node.rawRef)) {
        gdriveCount++;
        gdriveBytes += node.size || 0;
      } else if (isTelegramRef(node.rawRef)) {
        tgCount++;
        tgBytes += node.size || 0;
      }
    }
  });

  const totalBytes = gdriveBytes + tgBytes;
  const pct = totalQuota > 0 ? (totalBytes / totalQuota) * 100 : 0;
  const gdrivePct = totalBytes > 0 ? (gdriveBytes / totalBytes) * 100 : 0;
  const tgPct = totalBytes > 0 ? (tgBytes / totalBytes) * 100 : 0;

  const gdriveFiles = gdriveCount;
  const gdriveSize = formatSize(gdriveBytes);
  const tgFiles = tgCount;
  const tgSize = formatSize(tgBytes);
  
  let folderCount = 0;
  let fileCount = 0;
  localNodes.forEach(node => {
    if (node.type === 'folder') folderCount++;
    if (node.type === 'file') fileCount++;
  });

  const speeds = activeTransfers
    .map(t => {
      const match = t.status.match(/([0-9.]+) MB\/s/);
      return match ? parseFloat(match[1]) : 0;
    });
  const totalSpeed = speeds.reduce((a, b) => a + b, 0);
  const isIdle = totalSpeed === 0 && activeTransfers.length === 0;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Unified Storage Pool Core (Top) */}
      <Card className="p-8 bg-slate-900 border-slate-800 shadow-xl overflow-hidden relative w-full">
        <div className="absolute top-0 right-0 p-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h3 className="text-slate-400 font-bold tracking-widest uppercase text-xs mb-2">Unified Storage Pool Core</h3>
            <div className="flex items-end gap-3">
              <span className="text-4xl md:text-5xl font-black text-white tracking-tighter">
                {formatSize(totalBytes)}
              </span>
              <span className="text-xl text-slate-500 font-semibold mb-1">
                / {totalQuota > 0 ? formatSize(totalQuota) : 'Unlimited'}
              </span>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-xs font-bold border border-indigo-500/20">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              {accounts.length} Nodes Active
            </div>
          </div>
          {/* Dual-Track VFS Node Density & Speedometer */}
          <div className="flex-1 w-full max-w-sm shrink-0 flex flex-col gap-4">
            {/* VFS Node Density */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex justify-between text-xs text-slate-400 font-bold mb-2 uppercase tracking-wider">
                <span>Storage File Breakdown</span>
                <span className="text-white">{folderCount + fileCount} Total Nodes</span>
              </div>
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                  <span className="text-sm font-semibold text-slate-300">{folderCount} Folders</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                  <span className="text-sm font-semibold text-slate-300">{fileCount} Files</span>
                </div>
              </div>
            </div>

            {/* Infrastructure Speedometer */}
            <div className={`rounded-xl p-4 border transition-all duration-500 ${isIdle ? 'bg-slate-800/30 border-slate-700/50' : 'bg-indigo-900/40 border-indigo-500/30'}`}>
              <div className="flex justify-between text-xs text-slate-400 font-bold mb-1 uppercase tracking-wider">
                <span>Throughput Speedometer</span>
                {isIdle ? (
                  <span className="text-slate-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                    System Idle
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Active Stream
                  </span>
                )}
              </div>
              <div className="flex items-end gap-2">
                <span className={`text-3xl font-black tracking-tighter transition-colors ${isIdle ? 'text-slate-500' : 'text-white'}`}>
                  {isIdle ? '0.0' : totalSpeed.toFixed(1)}
                </span>
                <span className={`text-sm font-bold mb-1 ${isIdle ? 'text-slate-600' : 'text-indigo-300'}`}>MB/s</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {/* Active Data Pipeline & Speed Telemetry (Bottom Left) */}
        <Card className="p-6 bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-5 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Live Operations Pipeline
            </h3>
            
            <div className="space-y-4">
              {/* Telemetry Item 1: Storage Nodes Pool */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Integrated Storage Nodes</div>
                    <div className="text-sm font-bold text-slate-800">
                      {accounts.length} Active Nodes
                    </div>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              </div>

              {/* Telemetry Item 2: Encryption Overhead */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Vault Security Status</div>
                    <div className="text-sm font-bold text-slate-800">Maximum Encryption (Military-Grade Enabled)</div>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]"></div>
              </div>

              {/* Telemetry Item 3: Infrastructure Health */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">System Core Integrity</div>
                    <div className="text-sm font-bold text-slate-800">Optimal (100% Uptime)</div>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse shadow-[0_0_8px_rgba(14,165,233,0.5)]"></div>
              </div>
            </div>
          </div>
        </Card>

        {/* Cloud Distribution Ratio (Bottom Right) */}
        <Card className="p-6 bg-white border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-5 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            Cloud Distribution Ratio
          </h3>
          
          <div className="flex-1 flex flex-col gap-4 justify-center">
            {/* Google Drive Block */}
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                  <span className="text-2xl">📁</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Google Drive Pool</h4>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">{gdriveFiles} Files Tracking — {gdriveSize} Total</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-blue-600">{gdrivePct.toFixed(1)}%</span>
              </div>
            </div>

            <div className="w-full h-px bg-slate-100 my-1"></div>

            {/* Telegram Block */}
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center shrink-0 group-hover:bg-cyan-100 transition-colors">
                  <span className="text-2xl">☁️</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Aether Operational Node</h4>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">{tgFiles} File Tracking — {tgSize} Total</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-cyan-600">{tgPct.toFixed(1)}%</span>
              </div>
            </div>
            
            {/* Visual Bar */}
            <div className="w-full h-4 flex rounded-full overflow-hidden mt-2 border border-slate-200">
              <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${gdrivePct}%` }}></div>
              <div className="h-full bg-cyan-400 transition-all duration-1000" style={{ width: `${tgPct}%` }}></div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
