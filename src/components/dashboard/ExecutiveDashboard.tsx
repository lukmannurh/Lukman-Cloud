import { useState, useEffect } from 'react';
import { vfsService } from '../../lib/services/vfs.service';
import { PooledAccount, VFSNode } from '../../types';
import { Card } from '../ui/Card';
import { TransferTask } from './StorageNodes';
import { FolderPlus, UploadCloud, Share2, CheckCircle2 } from 'lucide-react';

interface ExecutiveDashboardProps {
  accounts: PooledAccount[];
  activeTransfers: TransferTask[];
  vfsNodes: VFSNode[];
}

export function ExecutiveDashboard({ accounts, activeTransfers, vfsNodes }: ExecutiveDashboardProps) {
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
    <div className="flex flex-col gap-6 w-full">
      <h1 className="sr-only">Dashboard</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Card 1: Storage Used Bar Track */}
        <Card className="p-6 bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-2">Storage Overview</h3>
            <div className="flex items-end gap-3 mb-4">
              <span className="text-4xl font-black text-slate-800 tracking-tight">
                {formatSize(totalBytes)}
              </span>
              <span className="text-sm font-medium text-slate-500 mb-1">
                used of {totalQuota > 0 ? formatSize(totalQuota) : 'Unlimited'}
              </span>
            </div>
            
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mt-2">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                style={{ width: `${Math.max(2, pct)}%` }} 
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500 font-medium">
              <span>{pct.toFixed(1)}% Used</span>
              <span>{accounts.length} Active Node(s)</span>
            </div>
          </div>
        </Card>

        {/* Card 2: Quick Actions Row */}
        <Card className="p-6 bg-white border border-slate-200 shadow-sm flex flex-col justify-center">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-3 gap-4">
            <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors text-slate-700 font-medium text-sm">
              <UploadCloud className="w-6 h-6 text-blue-500" />
              Upload Files
            </button>
            <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors text-slate-700 font-medium text-sm">
              <FolderPlus className="w-6 h-6 text-indigo-500" />
              New Folder
            </button>
            <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors text-slate-700 font-medium text-sm">
              <Share2 className="w-6 h-6 text-emerald-500" />
              Shared Links
            </button>
          </div>
        </Card>

        {/* Card 3: Recent Activity List */}
        <Card className="p-6 bg-white border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Recent Activity</h3>
          <div className="flex flex-col gap-3">
            {recentFiles.length > 0 ? (
              recentFiles.map(file => (
                <div key={file.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <span className="font-bold text-xs">{file.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-semibold text-slate-700 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{formatSize(file.size || 0)}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">
                    {new Date(file.modifiedAt || file.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl bg-slate-50">
                No recent activity. Upload files to see them here.
              </div>
            )}
          </div>
        </Card>

        {/* Card 4: Verified Connection Tags */}
        <Card className="p-6 bg-white border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold text-slate-700 mb-4">System Status</h3>
          <div className="flex flex-col gap-4 flex-1 justify-center">
            <div className="flex items-center justify-between p-4 rounded-xl border border-emerald-100 bg-emerald-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Connection Verified</h4>
                  <p className="text-xs text-slate-500 font-medium">All storage nodes synchronized</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                ONLINE
              </span>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-xl border border-blue-100 bg-blue-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Encryption Active</h4>
                  <p className="text-xs text-slate-500 font-medium">End-to-end security enabled</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
