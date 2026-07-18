import { useEffect, useState } from 'react';
import { supabase } from '../../lib/services/supabaseClient';
import { downloadService } from '../../lib/services/download.service';
import { VFSNode } from '../../types';
import { Download, File as FileIcon, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { Card } from '../ui/Card';
import { useParams } from 'react-router-dom';

export function AnonymousShareView({ sharedNodeId }: { sharedNodeId: string }) {
  // TASK 2: Strict media-only constants — must match all preview paths
  const PREVIEW_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const PREVIEW_VIDEO_EXTS = ['mp4', 'mkv', 'avi', 'mov', 'webm'];
  const [node, setNode] = useState<VFSNode | null>(null);
  const [children, setChildren] = useState<VFSNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'error'>('idle');

  useEffect(() => {
    async function loadSharedNode() {
      try {
        setLoading(true);
        // Map back base64 if needed, though typically it's the raw uuid
        let rawId = sharedNodeId;
        try {
          rawId = atob(sharedNodeId);
        } catch {
          // not base64 encoded
        }

        const { data, error: fetchErr } = await supabase
          .from('vfs_nodes')
          .select('*')
          .eq('id', rawId)
          .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!data) throw new Error('Shared file not found or you do not have permission.');

        const vfsNode: VFSNode = {
          id: data.id,
          name: data.name,
          type: data.is_folder ? 'folder' : 'file',
          size: data.size || 0,
          path: data.path,
          createdAt: data.raw_ref?.createdAt || new Date().toISOString(),
          modifiedAt: data.raw_ref?.modifiedAt || new Date().toISOString(),
          parentId: data.parent_id,
          children: [],
          rawRef: data.raw_ref,
          storageRef: data.storage_ref,
          telegramChannelId: data.telegramChannelId || data.storage_ref?.channel_id
        };
        setNode(vfsNode);

        // TASK 2: Only attempt Telegram preview for supported media extensions.
        // All other file types (APK, ZIP, PDF, RAR etc.) skip at ms-zero.
        const ext = vfsNode.name.split('.').pop()?.toLowerCase() || '';
        const isPreviewableImage = PREVIEW_IMAGE_EXTS.includes(ext);
        const isPreviewableVideo = PREVIEW_VIDEO_EXTS.includes(ext);

        if (vfsNode.type === 'folder') {
          const { data: childrenData, error: childrenErr } = await supabase
            .from('vfs_nodes')
            .select('*')
            .eq('parent_id', vfsNode.id);
            
          if (!childrenErr && childrenData) {
            setChildren(childrenData.map((d: any) => ({
              id: d.id,
              name: d.name,
              type: d.is_folder ? 'folder' : 'file',
              size: d.size || 0,
              path: d.path,
              createdAt: d.raw_ref?.createdAt || new Date().toISOString(),
              modifiedAt: d.raw_ref?.modifiedAt || new Date().toISOString(),
              parentId: d.parent_id,
              children: [],
              rawRef: d.raw_ref,
              storageRef: d.storage_ref,
              telegramChannelId: d.telegram_channel_id || d.storage_ref?.channel_id
            })));
          }
          setLoading(false);
          return;
        }

        if (isPreviewableImage || isPreviewableVideo) {
          try {
             let url: string | null = null;
             
             if (vfsNode.rawRef?.provider === 'telegram' || vfsNode.telegramChannelId) {
                const BOT_POOL = [
                  import.meta.env.VITE_TELEGRAM_BOT_TOKEN_P,
                  import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W1,
                  import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W2,
                  import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W3,
                  import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W4,
                  import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W5
                ].filter(Boolean) as string[];
                
                if (BOT_POOL.length === 0) {
                  console.error('[Share] Critical: No VITE_TELEGRAM_BOT_TOKEN environment variables found.');
                  throw new Error('Storage Nodes Offline: Missing Telegram Bot Tokens');
                }
                let availableTokens = [...BOT_POOL];
                let activeWorker: Worker | null = null;
                let connected = false;

                while (!connected && availableTokens.length > 0) {
                  const randomToken = availableTokens[Math.floor(Math.random() * availableTokens.length)];
                  activeWorker = new Worker(new URL('../../workers/telegram.worker.ts', import.meta.url), { type: 'module' });
                  
                  const connectPromise = new Promise<boolean>((resolve) => {
                    let isResolved = false;
                    const timeout = setTimeout(() => {
                      if (!isResolved) {
                        isResolved = true;
                        activeWorker?.terminate();
                        resolve(false);
                      }
                    }, 10000);

                    const handler = (msg: MessageEvent) => {
                      if (isResolved) return;
                      if (msg.data.type === 'WORKER_READY') {
                        isResolved = true;
                        clearTimeout(timeout);
                        activeWorker?.removeEventListener('message', handler);
                        resolve(true);
                      } else if (msg.data.type === 'ERROR' && (msg.data.message.includes('ACCESS_TOKEN_EXPIRED') || msg.data.message.includes('ImportBotAuthorization') || msg.data.message.includes('timed out'))) {
                        isResolved = true;
                        clearTimeout(timeout);
                        activeWorker?.removeEventListener('message', handler);
                        activeWorker?.terminate();
                        resolve(false);
                      }
                    };
                    activeWorker.addEventListener('message', handler);
                    activeWorker.postMessage({ 
                      type: 'CONNECT', 
                      payload: {
                        apiId: 35691342, 
                        apiHash: '84d8f1a2c0e9c4c09cff23316db186ec',
                        token: randomToken
                      }
                    });
                  });

                  connected = await connectPromise;
                  if (!connected) {
                    availableTokens = availableTokens.filter(t => t !== randomToken);
                    console.warn('[Share] Preview Token failed auth, blacklisted slot. Retrying...');
                  }
                }

                if (!connected || !activeWorker) {
                  throw new Error('All storage nodes failed authentication.');
                }
                
                
                let ref = vfsNode.rawRef;
                if (!ref || !ref.chunks) {
                   ref = {
                     provider: 'telegram',
                     channel_id: vfsNode.telegramChannelId || vfsNode.rawRef?.channelId || '',
                     message_id: vfsNode.rawRef?.chunks?.[0]?.messageId || 0,
                     chunks: vfsNode.rawRef?.chunks || []
                   } as any;
                }
                                // TASK 2: Strict 7-second timeout race for preview decryption
                 const downloadPromise = downloadService.downloadFromTelegram(ref as any, [activeWorker], undefined, vfsNode.mimeType, vfsNode.telegramChannelId);
                 const timeoutPromise = new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Preview timed out after 7s')), 7000));
                 
                 url = await Promise.race([downloadPromise, timeoutPromise]) as string;
             }

             if (url) {
               setPreviewUrl(url);
             }
          } catch(e) {
             console.error('Preview fetch failed:', e);
             setPreviewError(true);
          }
        } else {
          // TASK 2: Non-media file — immediately signal preview unavailable, no Telegram touch
          setPreviewError(true);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load shared file.');
      } finally {
        setLoading(false);
      }
    }
    if (sharedNodeId) loadSharedNode();
  }, [sharedNodeId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !node) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md p-6 text-center border-rose-500/20 bg-rose-500/5">
          <p className="text-rose-400 font-medium mb-2">Unavailable</p>
          <p className="text-slate-400 text-sm">{error || 'This file may have been deleted or the link is invalid.'}</p>
        </Card>
      </div>
    );
  }

  const ext = node.name.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  const isVideo = ['mp4', 'webm', 'ogg', 'mkv', 'avi', 'mov'].includes(ext);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-8">
      {node.type === 'folder' ? (
        <Card className="w-full max-w-5xl border-slate-800 bg-slate-900/80 backdrop-blur shadow-2xl overflow-hidden flex flex-col p-6 min-h-[500px]">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <FileIcon className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{node.name}</h1>
              <p className="text-slate-400 text-sm">Public Folder • {children.length} item(s)</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto">
            {children.map(child => (
              <a 
                key={child.id}
                href={`/share/${btoa(child.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-xl border border-slate-800 bg-slate-800/30 hover:bg-slate-800/70 transition-all group"
              >
                <div className="p-2 rounded-lg bg-slate-900 group-hover:bg-slate-950 transition-colors">
                  {child.type === 'folder' ? <FileIcon className="w-5 h-5 text-indigo-400" /> : <FileIcon className="w-5 h-5 text-slate-400" />}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">{child.name}</p>
                  {child.type !== 'folder' && <p className="text-xs text-slate-500">{(child.size / 1024 / 1024).toFixed(2)} MB</p>}
                </div>
              </a>
            ))}
            {children.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500">
                This folder is empty.
              </div>
            )}
          </div>
        </Card>
      ) : (
      <Card className="w-full max-w-4xl border-slate-800 bg-slate-900/80 backdrop-blur shadow-2xl overflow-hidden flex flex-col md:flex-row">
        {/* Preview Section */}
        <div className="flex-1 bg-black/40 min-h-[300px] flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-slate-800">
          {previewUrl && !previewError ? (
            <>
              {isImage && <img src={previewUrl} alt={node.name} className="max-h-[60vh] object-contain rounded-lg shadow-lg" onError={() => setPreviewError(true)} />}
              {isVideo && <video src={previewUrl} controls className="max-h-[60vh] rounded-lg shadow-lg" onError={() => setPreviewError(true)} />}
              {!isImage && !isVideo && (
                <div className="text-slate-500 flex flex-col items-center">
                  <FileIcon className="w-16 h-16 mb-4 opacity-50" />
                  <p>Preview not available for this file type</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-slate-500 flex flex-col items-center text-center p-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-3">
                {isImage ? <ImageIcon className="w-8 h-8 text-slate-400" /> : isVideo ? <VideoIcon className="w-8 h-8 text-slate-400" /> : <FileIcon className="w-8 h-8 text-slate-400" />}
              </div>
              <p className="text-slate-300 font-medium text-sm">{(!isImage && !isVideo) ? 'Preview Unavailable' : (previewError ? 'Preview Unavailable' : 'Generating preview...')}</p>
              {(!isImage && !isVideo) && <p className="text-slate-500 text-xs mt-1">Use the download button to access this file</p>}
            </div>
          )}
        </div>

        {/* Details Section */}
        <div className="w-full md:w-80 p-6 flex flex-col bg-slate-900">
          <div className="mb-8">
            <h1 className="text-xl font-bold text-white mb-2 break-all">{node.name}</h1>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="bg-slate-800 px-2 py-1 rounded font-mono text-xs uppercase">{ext || 'FILE'}</span>
              <span>{(node.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          </div>

          <div className="mt-auto space-y-4">
            <button
              onClick={async () => {
                try {
                  setDownloadStatus('downloading');
                  if (previewUrl) {
                    const response = await fetch(previewUrl);
                    const finalBuffer = await response.arrayBuffer();
                    const downloadedBlob = new Blob([finalBuffer], { type: node.mimeType || 'application/octet-stream' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(downloadedBlob);
                    link.download = node.name;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setDownloadStatus('idle');
                    return;
                  }
                  
                  if (node.rawRef?.provider === 'telegram' || node.telegramChannelId) {
                    const BOT_POOL = [
                      import.meta.env.VITE_TELEGRAM_BOT_TOKEN_P,
                      import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W1,
                      import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W2,
                      import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W3,
                      import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W4,
                      import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W5
                    ].filter(Boolean) as string[];
                    
                    if (BOT_POOL.length === 0) {
                      alert('System Error: Target connection keys missing from production bundle. Re-build required.');
                      throw new Error('Storage Nodes Offline: Missing Telegram Bot Tokens');
                    }
                    let availableTokens = [...BOT_POOL];
                    let activeWorker: Worker | null = null;
                    let connected = false;

                    while (!connected && availableTokens.length > 0) {
                      const randomToken = availableTokens[Math.floor(Math.random() * availableTokens.length)];
                      activeWorker = new Worker(new URL('../../workers/telegram.worker.ts', import.meta.url), { type: 'module' });
                      
                      const connectPromise = new Promise<boolean>((resolve) => {
                        let isResolved = false;
                        const timeout = setTimeout(() => {
                          console.log('[Share Debug] connectPromise timeout fired after 10s for token', randomToken.substring(0, 5));
                          if (!isResolved) {
                            isResolved = true;
                            activeWorker?.terminate();
                            resolve(false);
                          }
                        }, 10000);

                        const handler = (msg: MessageEvent) => {
                          console.log('[Share Debug] Worker message received:', msg.data.type, msg.data.state || '', msg.data.error || msg.data.message || '');
                          if (isResolved) return;
                          if (msg.data.type === 'WORKER_READY') {
                            console.log('[Share Debug] WORKER_READY received');
                            isResolved = true;
                            clearTimeout(timeout);
                            activeWorker?.removeEventListener('message', handler);
                            resolve(true);
                          } else if (msg.data.type === 'ERROR' || msg.data.type === 'DOWNLOAD_ERROR' || (msg.data.type === 'STATE_CHANGE' && msg.data.state === 'DISCONNECTED')) {
                            console.log('[Share Debug] Error or Disconnected received. Resolving false.');
                            isResolved = true;
                            clearTimeout(timeout);
                            activeWorker?.removeEventListener('message', handler);
                            activeWorker?.terminate();
                            resolve(false);
                          }
                        };
                        activeWorker.addEventListener('message', handler);
                        activeWorker.postMessage({ 
                          type: 'CONNECT', 
                          payload: {
                            apiId: 35691342, 
                            apiHash: '84d8f1a2c0e9c4c09cff23316db186ec',
                            token: randomToken
                          }
                        });
                      });

                      connected = await connectPromise;
                      console.log('[Share Debug] connectPromise resolved with:', connected);
                      if (!connected) {
                        availableTokens = availableTokens.filter(t => t !== randomToken);
                        console.warn('[Share] Download Token failed auth, blacklisted slot. Retrying... (Remaining:', availableTokens.length, ')');
                      }
                    }

                    console.log('[Share Debug] Exited while loop. connected =', connected);
                    if (!connected || !activeWorker) {
                      console.log('[Share Debug] Throwing All storage nodes failed authentication.');
                      throw new Error('All storage nodes failed authentication.');
                    }
                    
                    let ref = node.rawRef;
                    if (!ref || !ref.chunks) {
                       ref = {
                         provider: 'telegram',
                         channelId: node.telegramChannelId || node.rawRef?.channelId || node.rawRef?.channel_id || '',
                         chunks: node.rawRef?.chunks || (node.rawRef?.messageId || node.rawRef?.message_id ? [{ messageId: node.rawRef?.messageId || node.rawRef?.message_id, chunkSize: node.size }] : [])
                       } as any;
                    }
                    
                    console.log('[Share] Accumulating chunks directly via Worker...');
                    const downloadedChunks: any[] = [];
                    const totalSize = ref.chunks.reduce((acc: number, c: any) => acc + c.chunkSize, 0);
                    
                    for (let i = 0; i < ref.chunks.length; i++) {
                      const chunk = ref.chunks[i];
                      const requestId = crypto.randomUUID();
                      
                      const chunkData = await new Promise<ArrayBuffer>((resolve, reject) => {
                        const handler = (msg: MessageEvent) => {
                          const data = msg.data;
                          if (data.requestId !== requestId) return;
                          
                          if (data.type === 'DOWNLOAD_PROGRESS') {
                             // TASK 3: Math.min(100,...) guards against chunk-size overflow
                             const currentLoaded = downloadedChunks.reduce((acc: number, c: any) => acc + c.byteLength, 0) + (data.progress * chunk.chunkSize);
                             const rawPercent = totalSize > 0 ? Math.round((currentLoaded / totalSize) * 100) : 0;
                             const percent = Math.min(100, Math.max(0, rawPercent));
                             console.log(`[Share] Download progress: ${percent}%`);
                          } else if (data.type === 'DOWNLOAD_COMPLETE') {
                             activeWorker?.removeEventListener('message', handler);
                             resolve(data.data);
                          } else if (data.type === 'DOWNLOAD_ERROR' || data.type === 'ERROR') {
                             activeWorker?.removeEventListener('message', handler);
                             reject(new Error(data.error || data.message || 'Worker error'));
                          }
                        };
                        
                        activeWorker!.addEventListener('message', handler);
                        activeWorker!.postMessage({
                          type: 'DOWNLOAD_FILE',
                          messageId: chunk.messageId,
                          channelId: node.telegramChannelId || ref.channelId || ref.channel_id,
                          expectedHash: '',
                          requestId
                        });
                      });
                      
                      downloadedChunks.push(chunkData);
                    }
                    
                    console.log('[Share] Buffer successfully loaded. Initiating virtual anchor click.');
                    const downloadedBlob = new Blob(downloadedChunks, { type: node.mimeType || 'application/octet-stream' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(downloadedBlob);
                    link.download = node.name;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setDownloadStatus('idle');
                    console.log('[Share] Download successfully completed');
                  }
                } catch (err: any) {
                  console.error('[Share] Direct download failed explicitly:', err);
                  setDownloadStatus('error');
                }
              }}
              disabled={downloadStatus === 'downloading'}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors"
            >
              <Download className="w-5 h-5" />
              {downloadStatus === 'downloading' ? 'Downloading chunks...' : downloadStatus === 'error' ? 'Download Failed - Retry' : 'Download File'}
            </button>
            <div className="text-center">
              <p className="text-xs text-slate-500">Shared securely via Lukman Cloud</p>
            </div>
          </div>
        </div>
      </Card>
      )}
    </div>
  );
}
