import { useEffect, useState } from 'react';
import { supabase } from '../../lib/services/supabaseClient';
import { downloadService } from '../../lib/services/download.service';
import { VFSNode } from '../../types';
import { Download, File as FileIcon, Image as ImageIcon, Video as VideoIcon, FileText } from 'lucide-react';
import { Card } from '../ui/Card';

export function AnonymousShareView({ sharedNodeId }: { sharedNodeId: string }) {
  const [node, setNode] = useState<VFSNode | null>(null);
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
          children: []
        };
        setNode(vfsNode);

        // Pre-fetch preview if supported
        const ext = vfsNode.name.split('.').pop()?.toLowerCase() || '';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
        const isVideo = ['mp4', 'mkv', 'mov', 'avi', 'webm', 'ogg'].includes(ext);

        if (isImage || isVideo) {
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
                    const handler = (msg: MessageEvent) => {
                      if (msg.data.type === 'WORKER_READY') {
                        activeWorker?.removeEventListener('message', handler);
                        resolve(true);
                      } else if (msg.data.type === 'ERROR' && (msg.data.message.includes('ACCESS_TOKEN_EXPIRED') || msg.data.message.includes('ImportBotAuthorization'))) {
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
                
                // Task 3: 5-second timeout race
                const downloadPromise = downloadService.downloadFromTelegram(ref as any, [activeWorker], undefined, vfsNode.mimeType, vfsNode.telegramChannelId);
                const timeoutPromise = new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Preview timed out')), 5000));
                
                url = await Promise.race([downloadPromise, timeoutPromise]) as string;
             }

             if (url) {
               setPreviewUrl(url);
             }
          } catch(e) {
             console.error("Preview fetch failed:", e);
             setPreviewError(true);
          }
        } else {
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
  const isVideo = ['mp4', 'webm', 'ogg'].includes(ext);
  const isPdf = ext === 'pdf';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-4xl border-slate-800 bg-slate-900/80 backdrop-blur shadow-2xl overflow-hidden flex flex-col md:flex-row">
        {/* Preview Section */}
        <div className="flex-1 bg-black/40 min-h-[300px] flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-slate-800">
          {previewUrl && !previewError ? (
            <>
              {isImage && <img src={previewUrl} alt={node.name} className="max-h-[60vh] object-contain rounded-lg shadow-lg" onError={() => setPreviewError(true)} />}
              {isVideo && <video src={previewUrl} controls className="max-h-[60vh] rounded-lg shadow-lg" onError={() => setPreviewError(true)} />}
              {isPdf && (
                <div className="w-full flex flex-col items-center justify-center text-center p-6 bg-slate-900/50 rounded-lg border border-slate-800">
                  <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-rose-400" />
                  </div>
                  <h3 className="text-white font-medium mb-2">Secure PDF Vault</h3>
                  <p className="text-slate-400 text-sm max-w-sm">
                    PDF Preview is deactivated for maximum system performance. Please use the direct download option below to read this document.
                  </p>
                </div>
              )}
              {!isImage && !isVideo && !isPdf && (
                <div className="text-slate-500 flex flex-col items-center">
                  <FileIcon className="w-16 h-16 mb-4 opacity-50" />
                  <p>Preview not available for this file type</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-slate-500 flex flex-col items-center">
              <p>{(!isImage && !isVideo && !isPdf) ? 'Preview Unavailable' : (previewError ? 'Preview Unavailable' : 'Preview generating...')}</p>
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
                        const handler = (msg: MessageEvent) => {
                          if (msg.data.type === 'WORKER_READY') {
                            activeWorker?.removeEventListener('message', handler);
                            resolve(true);
                          } else if (msg.data.type === 'ERROR' || msg.data.type === 'DOWNLOAD_ERROR' || (msg.data.type === 'STATE_CHANGE' && msg.data.state === 'DISCONNECTED')) {
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
                        console.warn('[Share] Download Token failed auth, blacklisted slot. Retrying...');
                      }
                    }

                    if (!connected || !activeWorker) {
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
                             const currentLoaded = downloadedChunks.reduce((acc, c) => acc + c.byteLength, 0) + (data.progress * chunk.chunkSize);
                             console.log(`[Share] Download progress: ${Math.round((currentLoaded / totalSize) * 100)}%`);
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
    </div>
  );
}
