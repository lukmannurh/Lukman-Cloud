import { useState, useEffect, useRef } from 'react';
import { VFSNode } from '../../types';
import { Card } from '../ui/Card';
import { ImageIcon, VideoIcon, FileAudio, FileText, FileArchive, Folder, File, Download, Copy, Edit2, Link, Info, X, AlertTriangle } from 'lucide-react';
import { DirectoryPickerModal } from './DirectoryPickerModal';
import { supabase } from '../../lib/services/supabaseClient';
import { Skeleton } from '../ui/Skeleton';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

const getFileIconInfo = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
    return { icon: <ImageIcon className="w-8 h-8 text-emerald-500" />, borderColor: 'border-emerald-200' };
  }
  if (['mp4', 'webm', 'ogg', 'mkv', 'avi', 'mov'].includes(ext)) {
    return { icon: <VideoIcon className="w-8 h-8 text-cyan-500" />, borderColor: 'border-cyan-200' };
  }
  if (['pdf', 'docx', 'txt', 'xlsx', 'csv', 'pptx', 'ipynb'].includes(ext)) {
    return { icon: <FileText className="w-8 h-8 text-rose-500" />, borderColor: 'border-rose-200' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { icon: <FileArchive className="w-8 h-8 text-amber-500" />, borderColor: 'border-amber-200' };
  }
  return { icon: <File className="w-8 h-8 text-slate-400" />, borderColor: 'border-slate-200' };
};

interface FileExplorerProps {
  nodes: VFSNode[];
  loading: boolean;
  onNavigateFolder: (id: string) => void;
  onDownloadFile: (fileNode: VFSNode) => void;
  onDeleteNode: (node: VFSNode) => void;
  onMoveNode: (node: VFSNode, targetFolderId: string) => void;
  onCopyNode: (node: VFSNode, targetFolderId: string) => void;
  onRenameNode: (node: VFSNode, newName: string) => void;
  onMoveToFolder?: (nodeId: string, targetFolderId: string) => void;
  onFetchPreviewUrl: (node: VFSNode) => Promise<string>;
  isGridView?: boolean;
  highlightedNodeId?: string | null;
  initialPreviewNodeId?: string | null;
}

export function FileExplorer({
  nodes,
  loading,
  onNavigateFolder,
  onDownloadFile,
  onDeleteNode,
  onMoveNode,
  onCopyNode,
  onRenameNode,
  onMoveToFolder,
  onFetchPreviewUrl,
  isGridView = true,
  highlightedNodeId = null,
  initialPreviewNodeId = null
}: FileExplorerProps) {
  
  const [menuAlignment, setMenuAlignment] = useState<'top' | 'bottom'>('bottom');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [previewNode, setPreviewNode] = useState<VFSNode | null>(null);
  const [infoNode, setInfoNode] = useState<VFSNode | null>(null);
  const [downloadConfirmNode, setDownloadConfirmNode] = useState<VFSNode | null>(null);
  const [renameNode, setRenameNode] = useState<VFSNode | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pickerModalNode, setPickerModalNode] = useState<{ node: VFSNode, type: 'copy' | 'move' } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [archiveFiles, setArchiveFiles] = useState<string[]>([]);
  const [shareNode, setShareNode] = useState<VFSNode | null>(null);
  const [deleteNode, setDeleteNode] = useState<VFSNode | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewNode(null);
        setDownloadConfirmNode(null);
        setInfoNode(null);
        setRenameNode(null);
        setShareNode(null);
        setDeleteNode(null);
        setPickerModalNode(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (initialPreviewNodeId) {
      const target = nodes.find(n => n.id === initialPreviewNodeId);
      if (target) setPreviewNode(target);
    }
  }, [initialPreviewNodeId, nodes]);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!previewNode) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setArchiveFiles([]);
      return;
    }

    let isMounted = true;
    setIsFetchingPreview(true);
    setPreviewError(false);
    setArchiveFiles([]);

    const ext = previewNode.name.split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
    const isVideo = ['mp4', 'mkv', 'mov', 'avi', 'webm', 'ogg'].includes(ext);

    if (!isImage && !isVideo) {
      setPreviewError(true);
      setIsFetchingPreview(false);
      return;
    }

    const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Preview timed out')), 7000));
    
    Promise.race([onFetchPreviewUrl(previewNode), timeoutPromise])
      .then(async (url) => {
        const ext = previewNode.name.split('.').pop()?.toLowerCase() || '';
        let finalUrl = url;
        
        // Depromoted PDF blob conversion - direct download only
        if (ext === 'pdf') {
          // Intentionally omitting PDF-to-Blob conversion for CSP stability
        }

        if (!isMounted) {
          URL.revokeObjectURL(finalUrl);
          return;
        }

        setPreviewUrl(finalUrl);
        setIsFetchingPreview(false);

        // Check for archive
        const isArchive = ['zip', 'rar', 'tar', 'gz'].includes(ext);
        
        if (isArchive && ext === 'zip') {
          try {
            // Lazy load JSZip only when needed
            const JSZip = (await import('jszip')).default;
            const res = await fetch(url);
            const blob = await res.blob();
            const zip = await JSZip.loadAsync(blob);
            const files = Object.keys(zip.files).filter(f => !zip.files[f].dir);
            if (isMounted) setArchiveFiles(files);
          } catch (e) {
            console.error('Failed to parse zip archive for preview', e);
            if (isMounted) setArchiveFiles([]);
          }
        }
      })
      .catch((err) => {
        console.error('Preview fetch failed', err);
        if (isMounted) {
          setIsFetchingPreview(false);
          setPreviewError(true);
        }
        // Forcefully reset active download/decryption percentage variable modal strictly to 0
        window.dispatchEvent(new CustomEvent('preview-timeout'));
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewNode?.id]);

  if (loading) {
    return (
      <>
        <h1 className="sr-only">My Drive Loading</h1>
        {isGridView ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 auto-rows-max w-full">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="w-full h-[160px] shrink-0">
                <Skeleton className="h-full w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col w-full border border-[#1e1e5a]/40 rounded-xl overflow-hidden bg-[#141432]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center p-4 border-b border-[#1e1e5a]/40">
                <Skeleton className="w-8 h-8 rounded-lg mr-4" />
                <Skeleton className="h-5 w-1/3 rounded" />
              </div>
            ))}
          </div>
        )}
      </>
    );
  }


  if (nodes.length === 0) {
    return (
      <div 
        className="flex items-center justify-center h-full min-h-[400px] w-full"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverFolderId('global_empty');
        }}
        onDragLeave={() => setDragOverFolderId(null)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverFolderId(null);
          // Handled by App.tsx drop zone if global, but we highlight the empty state
        }}
      >
        <div className={`p-12 text-center border-2 border-dashed rounded-xl max-w-md w-full transition-colors ${dragOverFolderId === 'global_empty' ? 'border-indigo-500 bg-indigo-500/10' : 'border-[#1e1e5a]/60 bg-[#141432]'}`}>
          <div className="w-16 h-16 rounded-full bg-[#1e1e5a]/40 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-zinc-200 mb-2">Folder is Empty</h2>
          <p className="text-sm text-zinc-400">Drag and drop files here to upload instantly</p>
        </div>
      </div>
    );
  }

  const folders = nodes.filter(e => e.type === 'folder');
  const files = nodes.filter(e => e.type === 'file');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };



  const renderContextMenu = (node: VFSNode) => {
    const isRoot = node.id === 'root' || node.name === 'Root';
    return (
      <div className="relative">
        <DropdownMenu.Root
          open={activeMenuId === node.id}
          onOpenChange={(isOpen) => setActiveMenuId(isOpen ? node.id : null)}
        >
          <DropdownMenu.Trigger asChild>
            <button
              data-testid={`context-menu-${node.name}`}
              onClick={(e) => { e.stopPropagation(); }}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-[#1e1e5a]/40 rounded-md transition-colors outline-none"
            >
              <span className="sr-only">Menu</span>
              ⋮
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content 
              side="bottom"
              align="end" 
              sideOffset={5}
              collisionPadding={16}
              className="w-48 bg-[#141432] border border-[#1e1e5a]/60 shadow-xl rounded-xl overflow-hidden z-[9999] text-sm font-medium animate-[scaleIn_0.1s_ease-out]"
            >
              <DropdownMenu.Item 
                onClick={(e) => { e.stopPropagation(); setDownloadConfirmNode(node); }}
                className="w-full text-left px-4 py-2.5 hover:bg-[#1e1e5a]/40 text-zinc-300 hover:text-indigo-400 transition-colors flex items-center gap-2 cursor-pointer outline-none"
              >
                <Download className="w-4 h-4" /> Download
              </DropdownMenu.Item>
              <DropdownMenu.Item 
                onClick={(e) => { e.stopPropagation(); setPickerModalNode({ node, type: 'copy' }); }}
                className="w-full text-left px-4 py-2.5 hover:bg-[#1e1e5a]/40 text-zinc-300 transition-colors flex items-center gap-2 border-t border-[#1e1e5a]/40 cursor-pointer outline-none"
              >
                <Copy className="w-4 h-4" /> Make a copy
              </DropdownMenu.Item>
              {!isRoot && (
                <>
                  <DropdownMenu.Item 
                    onClick={(e) => { e.stopPropagation(); setPickerModalNode({ node, type: 'move' }); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#1e1e5a]/40 text-zinc-300 transition-colors flex items-center gap-2 cursor-pointer outline-none"
                  >
                    <Folder className="w-4 h-4" /> Move to
                  </DropdownMenu.Item>
                  <DropdownMenu.Item 
                    onClick={(e) => { e.stopPropagation(); setRenameInput(node.name); setRenameNode(node); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#1e1e5a]/40 text-zinc-300 transition-colors flex items-center gap-2 border-t border-[#1e1e5a]/40 cursor-pointer outline-none"
                  >
                    <Edit2 className="w-4 h-4" /> Rename
                  </DropdownMenu.Item>
                </>
              )}
              <DropdownMenu.Item 
                onClick={async (e) => { 
                  e.stopPropagation(); 
                  try {
                    await supabase.from('vfs_nodes').update({ is_shared: true }).eq('id', node.id);
                  } catch(err) {
                    console.error('Failed to update share status', err);
                  }
                  const link = window.location.origin + '/share/' + btoa(node.id);
                  navigator.clipboard.writeText(link);
                  setToastMessage('Secure Share Link Copied to Clipboard');
                  setTimeout(() => setToastMessage(null), 3000);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-[#1e1e5a]/40 text-zinc-300 transition-colors flex items-center gap-2 cursor-pointer outline-none"
              >
                <Link className="w-4 h-4" /> Share link
              </DropdownMenu.Item>
              <DropdownMenu.Item 
                onClick={(e) => { e.stopPropagation(); setInfoNode(node); }}
                className="w-full text-left px-4 py-2.5 hover:bg-[#1e1e5a]/40 text-zinc-300 transition-colors flex items-center gap-2 border-t border-[#1e1e5a]/40 cursor-pointer outline-none"
              >
                <Info className="w-4 h-4" /> Details
              </DropdownMenu.Item>
              {!isRoot && (
                <DropdownMenu.Item 
                  onClick={(e) => { e.stopPropagation(); setDeleteNode(node); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-rose-500/10 text-rose-400 transition-colors flex items-center gap-2 border-t border-[#1e1e5a]/40 cursor-pointer outline-none"
                >
                  <X className="w-4 h-4" /> Delete
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    );
  };

  return (
    <>
      <h1 className="sr-only">My Drive</h1>
      {isGridView ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 auto-rows-max w-full">
          {folders.map(folder => (
            <div
              key={folder.id}
              onClick={() => onNavigateFolder(folder.id)}
              className="text-left cursor-pointer focus:outline-none relative w-full h-[160px] shrink-0"
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={() => setDragOverFolderId(folder.id)}
              onDragLeave={() => setDragOverFolderId(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverFolderId(null);
                const fileId = e.dataTransfer.getData("text/plain");
                if (fileId && onMoveToFolder) {
                  onMoveToFolder(fileId, folder.id);
                }
              }}
            >
              <Card hoverable className={`h-full flex flex-col p-4 bg-[#141432] hover:bg-[#1a1a40] cursor-pointer shadow-sm rounded-xl transition-all ${highlightedNodeId === folder.id ? 'border-2 border-indigo-400 bg-indigo-500/10 scale-[1.02] ring-2 ring-indigo-500 animate-pulse' : dragOverFolderId === folder.id ? 'border-2 border-indigo-500 ' : 'border border-[#1e1e5a]/40'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center justify-center p-2 bg-[#0a0a1a]/60 rounded-lg border border-[#1e1e5a]/40">
                    <Folder className="w-8 h-8 text-zinc-400 fill-zinc-500/20" />
                  </div>
                  {renderContextMenu(folder)}
                </div>
                <div className="font-medium text-zinc-200 text-sm line-clamp-2 mt-auto" title={folder.name}>
                  {folder.name}
                </div>
              </Card>
            </div>
          ))}
          
          {files.map(file => {
            const provider = file.storageRef?.provider || file.rawRef?.provider || 'google_drive';
            const { icon } = getFileIconInfo(file.name);
            return (
              <div
                key={file.id}
                onClick={() => setPreviewNode(file)}
                className="text-left cursor-pointer focus:outline-none relative w-full h-[160px] shrink-0"
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", file.id);
                }}
              >
                <Card hoverable className={`h-full flex flex-col p-4 bg-[#141432] hover:bg-[#1a1a40] border cursor-pointer shadow-sm rounded-xl transition-all ${highlightedNodeId === file.id ? 'border-indigo-400 bg-indigo-500/10 scale-[1.02] ring-2 ring-indigo-500 animate-pulse' : 'border-[#1e1e5a]/40'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center justify-center p-2 bg-[#0a0a1a]/60 rounded-lg border border-[#1e1e5a]/40">
                      {icon}
                    </div>
                    <div className="flex items-center gap-2">
                      {renderContextMenu(file)}
                    </div>
                  </div>
                  <div className="font-medium text-zinc-200 text-sm line-clamp-2 mb-1" title={file.name}>
                    {file.name}
                  </div>
                  <div className="text-xs text-zinc-400 mt-auto font-medium">
                    {formatSize(file.size || 0)}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col w-full border border-[#1e1e5a]/40 rounded-xl overflow-hidden bg-[#141432]">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-[#1e1e5a]/40 bg-[#0a0a1a]/60 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            <div className="col-span-6 md:col-span-7">Name</div>
            <div className="col-span-3 md:col-span-2 text-right">File Size</div>
            <div className="col-span-3 md:col-span-2 hidden md:block text-right">Last Modified</div>
            <div className="col-span-3 md:col-span-1 flex justify-end"></div>
          </div>
          <div className="divide-y divide-[#1e1e5a]/40">
            {folders.map(folder => (
              <div
                key={folder.id}
                onClick={() => onNavigateFolder(folder.id)}
                className={`grid grid-cols-12 gap-4 p-4 items-center cursor-pointer transition-colors ${highlightedNodeId === folder.id ? 'bg-indigo-500/10 ring-2 ring-indigo-500 animate-pulse' : 'hover:bg-[#1a1a40]'}`}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={() => setDragOverFolderId(folder.id)}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverFolderId(null);
                  const fileId = e.dataTransfer.getData("text/plain");
                  if (fileId && onMoveToFolder) {
                    onMoveToFolder(fileId, folder.id);
                  }
                }}
              >
                <div className="col-span-6 md:col-span-7 flex items-center gap-3 overflow-hidden">
                  <div className={`flex items-center justify-center p-1.5 rounded-lg shrink-0 ${dragOverFolderId === folder.id ? 'bg-indigo-500/20' : 'bg-[#0a0a1a]/60 border border-[#1e1e5a]/40'}`}>
                    <Folder className={`w-5 h-5 ${dragOverFolderId === folder.id ? 'text-indigo-400' : 'text-zinc-400 fill-zinc-500/20'}`} />
                  </div>
                  <span className="font-medium text-zinc-200 truncate text-sm" title={folder.name}>{folder.name}</span>
                </div>
                <div className="col-span-3 md:col-span-2 text-right text-xs text-zinc-400 font-medium">{folder.size ? formatSize(folder.size) : '--'}</div>
                <div className="col-span-3 md:col-span-2 hidden md:block text-right text-xs text-zinc-400 font-medium">{folder.modifiedAt ? new Date(folder.modifiedAt).toLocaleDateString() : '--'}</div>
                <div className="col-span-3 md:col-span-1 flex justify-end shrink-0 relative">{renderContextMenu(folder)}</div>
              </div>
            ))}
            
            {files.map(file => {
              const { icon } = getFileIconInfo(file.name);
              return (
                <div
                  key={file.id}
                  onClick={() => setPreviewNode(file)}
                  className={`grid grid-cols-12 gap-4 p-4 items-center cursor-pointer transition-colors ${highlightedNodeId === file.id ? 'bg-indigo-500/10 ring-2 ring-indigo-500 animate-pulse' : 'hover:bg-[#1a1a40]'}`}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", file.id);
                  }}
                >
                  <div className="col-span-6 md:col-span-7 flex items-center gap-3 overflow-hidden">
                    <div className="flex items-center justify-center p-1.5 bg-[#0a0a1a]/60 border border-[#1e1e5a]/40 rounded-lg shrink-0">
                      {icon && <span className="[&>svg]:w-5 [&>svg]:h-5">{icon}</span>}
                    </div>
                    <span className="font-medium text-zinc-200 truncate text-sm" title={file.name}>{file.name}</span>
                  </div>
                  <div className="col-span-3 md:col-span-2 text-right text-xs text-zinc-400 font-medium">{formatSize(file.size || 0)}</div>
                  <div className="col-span-3 md:col-span-2 hidden md:block text-right text-xs text-zinc-400 font-medium">{file.modifiedAt ? new Date(file.modifiedAt).toLocaleDateString() : '--'}</div>
                  <div className="col-span-3 md:col-span-1 flex justify-end shrink-0 relative">{renderContextMenu(file)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Google Drive-Style Preview Modal */}
      {previewNode && (
        <div className="fixed inset-0 z-50 bg-[#0a0a1a]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141432] rounded-2xl w-full max-w-4xl shadow-2xl p-6 relative flex flex-col animate-[scaleIn_0.2s_ease-out] max-h-[90vh] ring-1 ring-white/5 border border-[#1e1e5a]/40">
            {/* Header & Toolbar */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#1e1e5a]/40 shrink-0">
              <div className="flex items-center gap-3 overflow-hidden">
                <span className="text-3xl shrink-0"></span>
                <div className="truncate">
                  <h3 data-testid="file-name" className="text-xl font-bold text-zinc-100 truncate">{previewNode.name}</h3>
                  <p className="text-sm text-zinc-400">{formatSize(previewNode.size || 0)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <button
                  onClick={() => setDownloadConfirmNode(previewNode)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
                <button
                  onClick={() => setPreviewNode(null)}
                  className="text-zinc-400 hover:text-zinc-200 p-2 rounded-full hover:bg-[#1e1e5a]/40 transition-colors focus:outline-none"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 overflow-y-auto bg-[#0a0a1a]/40 rounded-xl border border-[#1e1e5a]/40 flex flex-col relative min-h-[400px]">
              {isFetchingPreview ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                  <p className="text-zinc-400 font-medium tracking-tight">Decrypting Secure Stream...</p>
                </div>
              ) : previewError ? (
                <div className="m-auto text-center p-8">
                  <div className="w-24 h-24 bg-rose-500/10 text-rose-500 shadow-sm border border-rose-500/20 rounded-2xl mx-auto flex items-center justify-center mb-4">
                    <AlertTriangle className="w-8 h-8 text-rose-400" />
                  </div>
                  <h4 className="text-lg font-bold text-zinc-200 mb-2">Decryption Failed</h4>
                  <p className="text-sm text-zinc-400 max-w-sm mx-auto">
                    Failed to decrypt the secure preview stream. The storage block may be incomplete or you are experiencing connectivity issues.
                  </p>
                </div>
              ) : previewUrl ? (
                (() => {
                  const ext = previewNode.name.split('.').pop()?.toLowerCase() || '';
                  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
                  const isVideo = ['mp4', 'webm', 'ogg', 'mkv'].includes(ext);
                  const isPdf = ext === 'pdf';
                  const isArchive = ['zip', 'rar', 'tar', 'gz'].includes(ext);

                  if (isImage) {
                    return (
                      <div className="w-full h-full p-4 flex items-center justify-center bg-slate-900 rounded-xl overflow-hidden">
                        <img src={previewUrl} alt={previewNode.name} loading="lazy" className="max-h-[65vh] w-auto object-contain mx-auto rounded-lg shadow-sm" onError={() => setPreviewError(true)} />
                      </div>
                    );
                  }
                  
                  if (isVideo) {
                    return (
                      <div className="w-full h-full p-4 flex items-center justify-center bg-black rounded-xl overflow-hidden">
                        <video src={previewUrl} controls className="w-full max-h-[65vh] rounded-lg shadow-sm" onError={() => setPreviewError(true)} />
                      </div>
                    );
                  }

                  if (isPdf) {
                    return (
                      <div className="w-full h-[300px] bg-slate-900/50 rounded-xl border border-slate-800 flex flex-col items-center justify-center p-6 text-center">
                         <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4">
                           <FileText className="w-8 h-8 text-rose-400" />
                         </div>
                         <h3 className="text-white font-medium mb-2">Secure PDF storage</h3>
                         <p className="text-slate-400 text-sm max-w-sm">
                           PDF Preview is deactivated for maximum system performance. Please use the direct download option below to read this document.
                         </p>
                      </div>
                    );
                  }



                  return (
                    <div className="text-center m-auto p-12 bg-[#141432] rounded-2xl shadow-sm border border-[#1e1e5a]/40 max-w-lg">
                      <div className="w-20 h-20 bg-[#0a0a1a]/60 text-zinc-400 rounded-2xl mx-auto flex items-center justify-center mb-6 border border-[#1e1e5a]/40 shadow-inner">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <h4 className="text-xl font-bold text-zinc-200 mb-3 tracking-tight">Preview Unavailable</h4>
                      <p className="text-sm text-zinc-400 max-w-md mx-auto mb-8 leading-relaxed">
                        Preview Unavailable for this file extension. Please use the direct high-speed download process below.
                      </p>
                      <button
                        onClick={() => handleDownloadClick(previewNode)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl font-bold shadow-md hover:shadow-lg transition-all w-full flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Initiate Secure Download
                      </button>
                    </div>
                  );
                })()
              ) : null}
            </div>
          </div>
        </div>
      )}
      
      {/* Download Confirmation Interceptor */}
      {downloadConfirmNode && (
        <div className="fixed inset-0 z-[60] bg-[#0a0a1a]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141432] rounded-2xl w-full max-w-md shadow-2xl p-6 relative flex flex-col animate-[scaleIn_0.2s_ease-out] ring-1 ring-white/5 border border-[#1e1e5a]/40">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-zinc-100 mb-2">Confirm File Decryption</h3>
              <p className="text-sm text-zinc-300">
                Are you sure you want to securely decrypt and download <br/><span className="font-semibold text-zinc-200">{downloadConfirmNode.name}</span> from the pooled storage?
              </p>
            </div>
            
            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={() => setDownloadConfirmNode(null)}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium text-zinc-300 bg-[#1e1e5a]/40 hover:bg-[#1e1e5a]/60 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDownloadFile(downloadConfirmNode);
                  setDownloadConfirmNode(null);
                  setPreviewNode(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow transition-all"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Detail / Info Sidebar - Google Drive Style */}
      {infoNode && (
        <>
          <div className="fixed inset-0 z-[60] bg-[#0a0a1a]/40 backdrop-blur-sm transition-opacity" onClick={() => setInfoNode(null)}></div>
          <div className="fixed inset-y-0 right-0 z-[70] w-full max-w-sm bg-[#141432] shadow-2xl border-l border-[#1e1e5a]/40 transform transition-transform duration-200 ease-in-out translate-x-0 flex flex-col">
            <div className="p-4 border-b border-[#1e1e5a]/40 flex items-center justify-between">
              <h3 className="font-medium text-zinc-100 text-lg">Details</h3>
              <button onClick={() => setInfoNode(null)} className="p-2 text-zinc-400 hover:bg-[#1e1e5a]/40 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-0 flex-1 overflow-y-auto">
              <div className="flex flex-col items-center justify-center p-8 bg-[#0a0a1a]/40 border-b border-[#1e1e5a]/40">
                <div className="w-16 h-16 flex items-center justify-center mb-4">
                  {getFileIconInfo(infoNode.name).icon}
                </div>
                <h4 className="font-medium text-zinc-200 text-center break-all w-full">{infoNode.name}</h4>
              </div>

              <div className="p-6 space-y-5">
                <h5 className="font-medium text-zinc-200 mb-2">Properties</h5>
                
                <div>
                  <label className="text-xs text-zinc-400 block mb-0.5">Type</label>
                  <div className="text-sm text-zinc-300">{infoNode.type === 'folder' ? 'Folder' : (infoNode.mimeType || 'File')}</div>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-0.5">Size</label>
                  <div className="text-sm text-zinc-300">{infoNode.size ? formatSize(infoNode.size) : '—'}</div>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-0.5">Location</label>
                  <div className="text-sm text-zinc-300">{infoNode.path.replace(`/${infoNode.name}`, '') || 'My Drive'}</div>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-0.5">Owner</label>
                  <div className="text-sm text-zinc-300">me</div>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-0.5">Created</label>
                  <div className="text-sm text-zinc-300">
                    {new Date(infoNode.createdAt).toLocaleString()}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs text-zinc-400 block mb-0.5">Modified</label>
                  <div className="text-sm text-zinc-300">
                    {new Date(infoNode.modifiedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Rename Modal */}
      {renameNode && (
        <div className="fixed inset-0 z-[60] bg-[#0a0a1a]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141432] rounded-xl w-full max-w-sm shadow-2xl p-6 relative flex flex-col animate-[scaleIn_0.2s_ease-out] ring-1 ring-white/5 border border-[#1e1e5a]/40">
            <h3 className="text-lg font-medium text-zinc-100 mb-4">Rename</h3>
            <input 
              type="text" 
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              className="w-full border border-slate-300 bg-white rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 mb-6 font-medium shadow-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onRenameNode(renameNode, renameInput);
                  setRenameNode(null);
                }
              }}
            />
            <div className="flex justify-end gap-3 w-full">
              <button
                onClick={() => setRenameNode(null)}
                className="px-4 py-2 rounded-lg font-medium text-zinc-400 hover:bg-[#1e1e5a]/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onRenameNode(renameNode, renameInput);
                  setRenameNode(null);
                }}
                className="px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteNode && (
        <div className="fixed inset-0 z-[60] bg-[#0a0a1a]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141432] rounded-xl w-full max-w-sm shadow-2xl p-6 relative flex flex-col animate-[scaleIn_0.2s_ease-out] ring-1 ring-white/5 border border-[#1e1e5a]/40">
            <h3 className="text-lg font-bold text-zinc-100 mb-2">Delete {deleteNode.type === 'folder' ? 'Folder' : 'File'}</h3>
            <p className="text-sm text-zinc-400 mb-6">
              Are you sure you want to delete <span className="font-semibold text-zinc-200">{deleteNode.name}</span>? 
            </p>
            <div className="flex justify-end gap-3 w-full">
              <button
                onClick={() => setDeleteNode(null)}
                className="px-4 py-2 rounded-lg font-medium text-zinc-400 hover:bg-[#1e1e5a]/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const nodeToDel = deleteNode;
                  setDeleteNode(null);
                  setToastMessage(`Deleted ${nodeToDel.name}`);
                  
                  // Simulating Undo logic. In a real app we'd hold off on actual deletion for a few seconds.
                  // For the sake of UI challenge:
                  let undone = false;
                  const timer = setTimeout(() => {
                    if (!undone) {
                      onDeleteNode(nodeToDel);
                    }
                  }, 4000);
                  
                  // Hacky way to inject undo state into toast
                  const handleUndo = () => {
                    undone = true;
                    clearTimeout(timer);
                    setToastMessage('Deletion undone');
                    setTimeout(() => setToastMessage(null), 2000);
                  };
                  (window as any).__lastUndo = handleUndo;
                  
                  setTimeout(() => { if(!undone) setToastMessage(null) }, 4000);
                }}
                className="px-4 py-2 rounded-lg font-medium text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-[70] bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-[slideUp_0.3s_ease-out]">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="text-sm font-medium">{toastMessage}</span>
          {toastMessage.startsWith('Deleted') && (
            <button 
              onClick={() => {
                if ((window as any).__lastUndo) (window as any).__lastUndo();
              }}
              className="ml-4 text-xs font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider underline underline-offset-2"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Directory Picker Modal */}
      <DirectoryPickerModal 
        isOpen={pickerModalNode !== null}
        onClose={() => setPickerModalNode(null)}
        title={pickerModalNode?.type === 'copy' ? 'Copy to...' : 'Move to...'}
        onConfirm={(targetFolderId) => {
          if (pickerModalNode) {
            if (pickerModalNode.type === 'copy') {
              onCopyNode(pickerModalNode.node, targetFolderId || 'root');
            } else {
              onMoveNode(pickerModalNode.node, targetFolderId || 'root');
            }
          }
        }}
      />
    </>
  );
}
