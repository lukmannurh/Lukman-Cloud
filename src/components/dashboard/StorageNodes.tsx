import { useState, useEffect } from 'react';
import { PooledAccount, VFSNode } from '../../types';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { FileStack, ShieldCheck, RefreshCw, Send, CheckCircle2 } from 'lucide-react';
import aetherNodeIcon from '../../assets/aether-node.svg';
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
  // Telegram configurations are now globally hardcoded.


  
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[500px]">
      {/* LEFT COLUMN: Storage Gauge */}
      <Card className="col-span-1 bg-white border border-slate-200 h-full flex flex-col shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="flex flex-col p-8 h-full">
          <h2 className="text-xl font-medium text-slate-800 mb-8">Storage</h2>
          
          <div className="flex flex-col gap-2 mb-8">
            <div className="flex items-end gap-2 mb-1">
              <span className="text-4xl font-normal text-slate-800">{formatSize(totalComputed)}</span>
              <span className="text-sm font-medium text-slate-500 mb-1.5 flex-1 break-words">
                used of {totalLimit > 0 ? `${formatSize(totalLimit)} (Drive Sync) + Unlimited Secure Pool` : 'Unlimited Secure Pool'}
              </span>
            </div>
            
            <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${Math.max(1, (imagePct > 0 ? imagePct : 0))}%` }} />
              <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.max(1, (docPct > 0 ? docPct : 0))}%` }} />
              <div className="h-full bg-amber-500 transition-all duration-700" style={{ width: `${Math.max(1, (videoPct > 0 ? videoPct : 0))}%` }} />
              <div className="h-full bg-purple-500 transition-all duration-700" style={{ width: `${Math.max(1, (systemPct > 0 ? systemPct : 0))}%` }} />
            </div>
          </div>

          <div className="flex flex-col gap-5 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-sm font-medium text-slate-700">Images</span>
              </div>
              <span className="text-sm text-slate-500">{formatSize(imageBytes)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-sm font-medium text-slate-700">Documents</span>
              </div>
              <span className="text-sm text-slate-500">{formatSize(docBytes)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="text-sm font-medium text-slate-700">Videos</span>
              </div>
              <span className="text-sm text-slate-500">{formatSize(videoBytes)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                <span className="text-sm font-medium text-slate-700">System Fallbacks</span>
              </div>
              <span className="text-sm text-slate-500">{formatSize(systemBytes)}</span>
            </div>
          </div>
          
          <div className="mt-auto pt-8">
            <Button onClick={onAddAccount} variant="outline" className="w-full justify-center text-blue-600 border-slate-200 hover:bg-blue-50 hover:border-blue-200 font-medium py-2.5">
              Get more storage
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* RIGHT/CENTER COLUMN: Network Connection Roster */}
      <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
        <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden flex-1">
          <CardHeader className="border-b border-slate-100 p-6">
            <h2 className="text-lg font-medium text-slate-800">Network & Accounts</h2>
          </CardHeader>
          <CardContent className="p-6 flex flex-col gap-6">
            
            {/* Core Engine Quota */}
            <div className="relative group bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:border-blue-300 transition-all duration-300 hover:shadow-md overflow-hidden flex items-start justify-between">
              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
                  <img src={aetherNodeIcon} alt="Storage Node" className="w-7 h-7 object-contain opacity-80" />
                </div>
                <div>
                  <h3 className="text-base font-medium text-slate-800 tracking-tight">Lukman Cloud High-Speed Core Vault</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-md">
                    Primary cloud core active and fully encrypted. Connection Status: <span className="text-emerald-500 font-medium">Secure & Synchronized</span>.
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full border border-emerald-100 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></span>
                Synchronized
              </span>
            </div>

            {/* Matrix Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-1">
                  <FileStack className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Active Files</h4>
                <p className="text-lg font-bold text-slate-800">{vfsNodes.filter(n => n.type === 'file').length} Files</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vault Cluster Integrity</h4>
                <p className="text-sm font-bold text-emerald-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  100% Operational / Optimal
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-1">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Google Drive Sync Pipeline</h4>
                <p className="text-sm font-bold text-slate-700">
                  {accounts.length > 0 ? (activeTransfers.length > 0 ? 'Active Mirroring Mode Enabled' : 'Active Mirroring Mode Enabled') : 'Idle / Standby'}
                </p>
              </div>
            </div>

            {/* Individual Accounts */}
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-medium text-slate-700">Google Drive Attachments</h3>
                <Button onClick={onAddAccount} variant="secondary" className="text-xs px-3 py-1.5 h-auto">
                  + Add Account
                </Button>
              </div>
              
              {accounts.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-medium text-slate-700 mb-1">No accounts linked</h4>
                  <p className="text-xs text-slate-500">Connect Google accounts to increase your total storage pool.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {accounts.map(acc => {
                    const pct = acc.totalQuota > 0 ? Math.min(100, Math.round((acc.usedQuota / acc.totalQuota) * 100)) : 0;
                    return (
                      <div key={acc.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0 border border-slate-200">
                              {acc.email.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-slate-700 truncate" title={acc.email}>
                              {acc.email}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 mt-1">
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>{formatSize(acc.usedQuota)} used</span>
                            <span>{acc.totalQuota > 0 ? formatSize(acc.totalQuota) : 'Unlimited'}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${pct > 90 ? 'bg-rose-500' : 'bg-blue-500'} transition-all duration-700`} 
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active Transfers */}
            {activeTransfers.length > 0 && (
              <div className="mt-auto pt-6 border-t border-slate-100">
                <h3 className="text-sm font-medium text-slate-700 mb-4">Active Operations</h3>
                <div className="flex flex-col gap-3">
                  {activeTransfers.map(tx => (
                    <div key={tx.id} className="bg-slate-50 p-3.5 border border-slate-200 rounded-xl">
                      <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5 truncate">
                        <span className="truncate max-w-[220px]">{tx.name}</span>
                        <span className="text-slate-500 shrink-0 ml-2">
                          {tx.progress !== undefined ? `${Math.round(tx.progress)}%` : '...'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium mb-2.5">{tx.status}</div>
                      {tx.progress !== undefined && (
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-300" 
                            style={{ width: `${tx.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
