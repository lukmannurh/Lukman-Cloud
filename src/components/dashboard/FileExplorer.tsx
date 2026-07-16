import { useState, useEffect, useRef } from 'react';
import { VFSNode } from '../../types';
import { Card } from '../ui/Card';
import { ImageIcon, VideoIcon, FileAudio, FileText, FileArchive, Folder, File, Download, Copy, Edit2, Link, Info, X } from 'lucide-react';
import JSZip from 'jszip';
import { DirectoryPickerModal } from './DirectoryPickerModal';

const getFileIconInfo = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
    return { icon: <ImageIcon className="w-8 h-8 text-emerald-500" />, borderColor: 'border-emerald-200' };
  }
  if (['mp4', 'webm', 'ogg', 'mkv'].includes(ext)) {
    return { icon: <VideoIcon className="w-8 h-8 text-cyan-500" />, borderColor: 'border-cyan-200' };
  }
  if (['mp3', 'wav'].includes(ext)) {
    return { icon: <FileAudio className="w-8 h-8 text-cyan-500" />, borderColor: 'border-cyan-200' };
  }
  if (['pdf', 'docx', 'txt'].includes(ext)) {
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

    onFetchPreviewUrl(previewNode)
      .then(async (url) => {
        const ext = previewNode.name.split('.').pop()?.toLowerCase() || '';
        let finalUrl = url;
        
        if (ext === 'pdf') {
          try {
            const res = await fetch(url);
            const buffer = await res.arrayBuffer();
            const pdfBlob = new Blob([buffer], { type: 'application/pdf' });
            finalUrl = URL.createObjectURL(pdfBlob);
            URL.revokeObjectURL(url);
          } catch (e) {
            console.error('Failed to convert PDF blob', e);
          }
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
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewNode?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <Card className="p-12 text-center animate-pulse bg-slate-50 border border-slate-200 shadow-sm rounded-xl w-full max-w-md">
          <h2 className="text-lg font-semibold text-slate-600 tracking-tight">Loading Directory...</h2>
        </Card>
      </div>
    );
  }


  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="p-12 text-center border-2 border-dashed border-slate-300 bg-slate-50 rounded-xl max-w-md w-full">
          <h2 className="text-lg font-semibold text-slate-600 mb-2">Folder is Empty</h2>
          <p className="text-sm text-slate-500">No files or subfolders found.</p>
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
        <button 
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            if (window.innerHeight - rect.bottom < 300) {
              setMenuAlignment('top');
            } else {
              setMenuAlignment('bottom');
            }
            setActiveMenuId(activeMenuId === node.id ? null : node.id);
          }}
          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
        >
          ⋮
        </button>
        {activeMenuId === node.id && (
          <div className={`absolute right-0 ${menuAlignment === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} w-48 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-[60] text-sm font-medium`}>
            <button 
              onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); setDownloadConfirmNode(node); }}
              className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Download
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); setPickerModalNode({ node, type: 'copy' }); }}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-2 border-t border-slate-100"
            >
              <Copy className="w-4 h-4" /> Make a Copy
            </button>
            {!isRoot && (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); setPickerModalNode({ node, type: 'move' }); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-2"
                >
                  <Folder className="w-4 h-4" /> Move to
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); setRenameInput(node.name); setRenameNode(node); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-2 border-t border-slate-100"
                >
                  <Edit2 className="w-4 h-4" /> Rename
                </button>
              </>
            )}
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                setActiveMenuId(null); 
                const link = window.location.origin + '/share/' + btoa(node.id);
                navigator.clipboard.writeText(link);
                setToastMessage('Secure Share Link Copied to Clipboard');
                setTimeout(() => setToastMessage(null), 3000);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-2"
            >
              <Link className="w-4 h-4" /> Share Link
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); setInfoNode(node); }}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-2 border-t border-slate-100"
            >
              <Info className="w-4 h-4" /> Detail / Info
            </button>
            {!isRoot && (
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); onDeleteNode(node); }}
                className="w-full text-left px-4 py-2.5 hover:bg-rose-50 text-rose-600 transition-colors flex items-center gap-2 border-t border-rose-50"
              >
                <X className="w-4 h-4" /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {isGridView ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {folders.map(folder => (
            <div
              key={folder.id}
              onClick={() => onNavigateFolder(folder.id)}
              className="text-left cursor-pointer focus:outline-none w-full relative"
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
              <Card hoverable className={`h-full flex flex-col p-4 bg-white hover:bg-slate-50 cursor-pointer min-h-[120px] shadow-sm rounded-xl transition-all ${highlightedNodeId === folder.id ? 'border-2 border-blue-400 bg-blue-50/50 scale-[1.02]' : dragOverFolderId === folder.id ? 'border-2 border-indigo-500 scale-105' : 'border border-slate-200'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center justify-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <Folder className="w-8 h-8 text-slate-500 fill-slate-500/20" />
                  </div>
                  {renderContextMenu(folder)}
                </div>
                <div className="font-medium text-slate-700 truncate text-sm sm:text-base mt-auto" title={folder.name}>
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
                className="text-left cursor-pointer focus:outline-none w-full relative"
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", file.id);
                }}
              >
                <Card hoverable className={`h-full flex flex-col p-4 bg-white hover:bg-slate-50 border cursor-pointer min-h-[120px] shadow-sm rounded-xl transition-all ${highlightedNodeId === file.id ? 'border-blue-400 bg-blue-50/50 scale-[1.02]' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center justify-center p-2 bg-slate-50 rounded-lg">
                      {icon}
                    </div>
                    <div className="flex items-center gap-2">
                      {renderContextMenu(file)}
                    </div>
                  </div>
                  <div className="font-medium text-slate-700 truncate text-sm sm:text-base mb-1" title={file.name}>
                    {file.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-auto font-medium">
                    {formatSize(file.size || 0)}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col w-full border border-slate-200 rounded-xl overflow-hidden bg-white">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <div className="col-span-6 md:col-span-7">Name</div>
            <div className="col-span-3 md:col-span-2 text-right">File Size</div>
            <div className="col-span-3 md:col-span-2 hidden md:block text-right">Last Modified</div>
            <div className="col-span-3 md:col-span-1 flex justify-end"></div>
          </div>
          <div className="divide-y divide-slate-100">
            {folders.map(folder => (
              <div
                key={folder.id}
                onClick={() => onNavigateFolder(folder.id)}
                className={`grid grid-cols-12 gap-4 p-4 items-center cursor-pointer transition-colors ${highlightedNodeId === folder.id ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
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
                  <div className={`flex items-center justify-center p-1.5 rounded-lg shrink-0 ${dragOverFolderId === folder.id ? 'bg-indigo-100' : 'bg-slate-50 border border-slate-100'}`}>
                    <Folder className={`w-5 h-5 ${dragOverFolderId === folder.id ? 'text-indigo-600' : 'text-slate-500 fill-slate-500/20'}`} />
                  </div>
                  <span className="font-medium text-slate-700 truncate text-sm" title={folder.name}>{folder.name}</span>
                </div>
                <div className="col-span-3 md:col-span-2 text-right text-xs text-slate-400 font-medium">--</div>
                <div className="col-span-3 md:col-span-2 hidden md:block text-right text-xs text-slate-400 font-medium">{folder.modifiedAt ? new Date(folder.modifiedAt).toLocaleDateString() : '--'}</div>
                <div className="col-span-3 md:col-span-1 flex justify-end shrink-0 relative">{renderContextMenu(folder)}</div>
              </div>
            ))}
            
            {files.map(file => {
              const { icon } = getFileIconInfo(file.name);
              return (
                <div
                  key={file.id}
                  onClick={() => setPreviewNode(file)}
                  className={`grid grid-cols-12 gap-4 p-4 items-center cursor-pointer transition-colors ${highlightedNodeId === file.id ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", file.id);
                  }}
                >
                  <div className="col-span-6 md:col-span-7 flex items-center gap-3 overflow-hidden">
                    <div className="flex items-center justify-center p-1.5 bg-slate-50 rounded-lg shrink-0">
                      {icon && <span className="[&>svg]:w-5 [&>svg]:h-5">{icon}</span>}
                    </div>
                    <span className="font-medium text-slate-700 truncate text-sm" title={file.name}>{file.name}</span>
                  </div>
                  <div className="col-span-3 md:col-span-2 text-right text-xs text-slate-500 font-medium">{formatSize(file.size || 0)}</div>
                  <div className="col-span-3 md:col-span-2 hidden md:block text-right text-xs text-slate-400 font-medium">{file.modifiedAt ? new Date(file.modifiedAt).toLocaleDateString() : '--'}</div>
                  <div className="col-span-3 md:col-span-1 flex justify-end shrink-0 relative">{renderContextMenu(file)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Google Drive-Style Preview Modal */}
      {previewNode && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl p-6 relative flex flex-col animate-[scaleIn_0.2s_ease-out] max-h-[90vh]">
            {/* Header & Toolbar */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3 overflow-hidden">
                <span className="text-3xl shrink-0">📄</span>
                <div className="truncate">
                  <h3 className="text-xl font-bold text-slate-800 truncate">{previewNode.name}</h3>
                  <p className="text-sm text-slate-500">{formatSize(previewNode.size || 0)}</p>
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
                  className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors focus:outline-none"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 rounded-xl border border-slate-200 flex flex-col relative min-h-[400px]">
              {isFetchingPreview ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                  <p className="text-slate-500 font-medium tracking-tight">Decrypting Secure Stream...</p>
                </div>
              ) : previewError ? (
                <div className="m-auto text-center p-8">
                  <div className="w-24 h-24 bg-rose-50 text-rose-500 shadow-sm border border-rose-200 rounded-2xl mx-auto flex items-center justify-center mb-4">
                    <span className="text-4xl">⚠️</span>
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 mb-2">Decryption Failed</h4>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto">
                    Failed to decrypt the secure preview stream. The storage block may be incomplete or you are experiencing connectivity issues.
                  </p>
                </div>
              ) : previewUrl ? (
                (() => {
                  const ext = previewNode.name.split('.').pop()?.toLowerCase() || '';
                  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
                  const isVideo = ['mp4', 'webm', 'ogg', 'mkv'].includes(ext);
                  const isAudio = ['mp3', 'wav', 'ogg'].includes(ext);
                  const isPdf = ext === 'pdf';
                  const isArchive = ['zip', 'rar', 'tar', 'gz'].includes(ext);

                  if (isImage) {
                    return (
                      <div className="w-full h-full p-4 flex items-center justify-center bg-slate-900 rounded-xl overflow-hidden">
                        <img src={previewUrl} alt={previewNode.name} className="max-h-[65vh] w-auto object-contain mx-auto rounded-lg shadow-sm" onError={() => setPreviewError(true)} />
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

                  if (isAudio) {
                    return (
                      <div className="w-full h-full p-8 flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white rounded-xl">
                        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-8 text-center flex flex-col items-center">
                          <div className="w-24 h-24 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-6 shadow-sm">
                            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                            </svg>
                          </div>
                          <h4 className="font-bold text-slate-800 text-xl mb-1 truncate w-full">{previewNode.name}</h4>
                          <p className="text-sm text-slate-500 mb-8 tracking-wide">Audio Stream Ready</p>
                          <audio src={previewUrl} controls className="w-full" onError={() => setPreviewError(true)} />
                        </div>
                      </div>
                    );
                  }

                  if (isPdf) {
                    return (
                      <div className="w-full h-[65vh] bg-slate-200 rounded-xl overflow-hidden relative">
                         <iframe src={previewUrl} type="application/pdf" className="w-full h-full border-0 absolute inset-0" title="PDF Preview" />
                      </div>
                    );
                  }



                  return (
                    <div className="text-center m-auto p-12 bg-white rounded-2xl shadow-sm border border-slate-200 max-w-lg">
                      <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-2xl mx-auto flex items-center justify-center mb-6 border border-slate-100 shadow-inner">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <h4 className="text-xl font-bold text-slate-800 mb-3 tracking-tight">Preview Unavailable</h4>
                      <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
                        Preview Unavailable for this file extension. Please use the direct high-speed download pipeline below.
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
        <div className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative flex flex-col animate-[scaleIn_0.2s_ease-out]">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Confirm File Decryption</h3>
              <p className="text-sm text-slate-500">
                Are you sure you want to securely decrypt and download <br/><span className="font-semibold text-slate-700">{downloadConfirmNode.name}</span> from the pooled vault?
              </p>
            </div>
            
            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={() => setDownloadConfirmNode(null)}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
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
          <div className="fixed inset-0 z-[60] bg-slate-950/20 backdrop-blur-sm transition-opacity" onClick={() => setInfoNode(null)}></div>
          <div className="fixed inset-y-0 right-0 z-[70] w-full max-w-sm bg-white shadow-2xl border-l border-slate-200 transform transition-transform duration-300 ease-in-out translate-x-0 flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-medium text-slate-800 text-lg">Details</h3>
              <button onClick={() => setInfoNode(null)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-0 flex-1 overflow-y-auto">
              <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border-b border-slate-200">
                <div className="w-16 h-16 flex items-center justify-center mb-4">
                  {getFileIconInfo(infoNode.name).icon}
                </div>
                <h4 className="font-medium text-slate-800 text-center break-all w-full">{infoNode.name}</h4>
              </div>

              <div className="p-6 space-y-5">
                <h5 className="font-medium text-slate-800 mb-2">Properties</h5>
                
                <div>
                  <label className="text-xs text-slate-500 block mb-0.5">Type</label>
                  <div className="text-sm text-slate-800">{infoNode.type === 'folder' ? 'Folder' : (infoNode.mimeType || 'File')}</div>
                </div>

                <div>
                  <label className="text-xs text-slate-500 block mb-0.5">Size</label>
                  <div className="text-sm text-slate-800">{infoNode.size ? formatSize(infoNode.size) : '—'}</div>
                </div>

                <div>
                  <label className="text-xs text-slate-500 block mb-0.5">Location</label>
                  <div className="text-sm text-slate-800">{infoNode.path.replace(`/${infoNode.name}`, '') || 'My Drive'}</div>
                </div>

                <div>
                  <label className="text-xs text-slate-500 block mb-0.5">Owner</label>
                  <div className="text-sm text-slate-800">me</div>
                </div>

                <div>
                  <label className="text-xs text-slate-500 block mb-0.5">Created</label>
                  <div className="text-sm text-slate-800">
                    {new Date(infoNode.createdAt).toLocaleString()}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs text-slate-500 block mb-0.5">Modified</label>
                  <div className="text-sm text-slate-800">
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
        <div className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-6 relative flex flex-col animate-[scaleIn_0.2s_ease-out]">
            <h3 className="text-lg font-medium text-slate-800 mb-4">Rename</h3>
            <input 
              type="text" 
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              className="w-full border-2 border-blue-500 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-0 mb-6"
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
                className="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100 transition-colors"
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

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-[70] bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-[slideUp_0.3s_ease-out]">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="text-sm font-medium">{toastMessage}</span>
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
