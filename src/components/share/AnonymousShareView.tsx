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
        if (!vfsNode.name.endsWith('.enc')) {
          try {
             let url: string | null = null;
             
             if (vfsNode.rawRef?.provider === 'telegram' || vfsNode.telegramChannelId) {
                const BOT_POOL = [
                  "778532517:AAGfLWpYw9-IIEhxs9b-7EL5Of7d3mXfKVk",
                  "8530091740:AAG_Cf0eAgBbzbceliZkvGlk6N2IO0NCwE0",
                  "7117929172:AAGcOgiLL6eBJknUxxmJev5hSJskt6is5kI",
                  "8899849951:AAF4p2xWnV0WNKS_1p6NMO8rch7dDMOMMWs",
                  "8914928600:AAGsgIh3ku7rMZeqCPsNAkrYiE4HGmXFIqY",
                  "8906497409:AAFVaz-MJ6gk48Mjulua6SWBDSL2p6GWw94"
                ];
                const randomToken = BOT_POOL[Math.floor(Math.random() * BOT_POOL.length)];
                
                const w = new Worker(new URL('../../workers/telegram.worker.ts', import.meta.url), { type: 'module' });
                w.postMessage({ 
                  type: 'CONNECT', 
                  apiId: 35691342, 
                  apiHash: '84d8f1a2c0e9c4c09cff23316db186ec',
                  botToken: randomToken
                });
                
                // Allow MTProto session to initialize
                await new Promise(r => setTimeout(r, 500));
                
                let ref = vfsNode.rawRef;
                if (!ref || !ref.chunks) {
                   ref = {
                     provider: 'telegram',
                     channel_id: vfsNode.telegramChannelId || vfsNode.rawRef?.channelId || '',
                     message_id: vfsNode.rawRef?.chunks?.[0]?.messageId || 0,
                     chunks: vfsNode.rawRef?.chunks || []
                   } as any;
                }
                
                url = await downloadService.downloadFromTelegram(ref as any, [w], undefined, vfsNode.mimeType, vfsNode.telegramChannelId);
             }

             if (url) {
               const ext = vfsNode.name.split('.').pop()?.toLowerCase() || '';
               if (ext === 'pdf') {
                 // Depromoted PDF blob conversion - direct download only
               }
               setPreviewUrl(url);
             }
          } catch(e) {
             console.error("Preview fetch failed:", e);
          }
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
              {isImage ? <ImageIcon className="w-16 h-16 mb-4 opacity-50" /> : isVideo ? <VideoIcon className="w-16 h-16 mb-4 opacity-50" /> : <FileIcon className="w-16 h-16 mb-4 opacity-50" />}
              <p>{previewError ? 'Preview failed to load' : 'Preview generating...'}</p>
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
                  if (previewUrl) {
                    const a = document.createElement('a');
                    a.href = previewUrl;
                    a.download = node.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    return;
                  }
                  
                  if (node.rawRef?.provider === 'telegram' || node.telegramChannelId) {
                    const BOT_POOL = [
                      "778532517:AAGfLWpYw9-IIEhxs9b-7EL5Of7d3mXfKVk",
                      "8530091740:AAG_Cf0eAgBbzbceliZkvGlk6N2IO0NCwE0",
                      "7117929172:AAGcOgiLL6eBJknUxxmJev5hSJskt6is5kI",
                      "8899849951:AAF4p2xWnV0WNKS_1p6NMO8rch7dDMOMMWs",
                      "8914928600:AAGsgIh3ku7rMZeqCPsNAkrYiE4HGmXFIqY",
                      "8906497409:AAFVaz-MJ6gk48Mjulua6SWBDSL2p6GWw94"
                    ];
                    const randomToken = BOT_POOL[Math.floor(Math.random() * BOT_POOL.length)];
                    
                    const w = new Worker(new URL('../../workers/telegram.worker.ts', import.meta.url), { type: 'module' });
                    w.postMessage({ 
                      type: 'CONNECT', 
                      apiId: 35691342, 
                      apiHash: '84d8f1a2c0e9c4c09cff23316db186ec',
                      botToken: randomToken
                    });
                    
                    await new Promise(r => setTimeout(r, 500));
                    
                    let ref = node.rawRef;
                    if (!ref || !ref.chunks) {
                       ref = {
                         provider: 'telegram',
                         channel_id: node.telegramChannelId || node.rawRef?.channelId || '',
                         message_id: node.rawRef?.chunks?.[0]?.messageId || 0,
                         chunks: node.rawRef?.chunks || []
                       } as any;
                    }
                    
                    const url = await downloadService.downloadFromTelegram(ref as any, [w], undefined, node.mimeType, node.telegramChannelId);
                    if (url) {
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = node.name;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }
                  }
                } catch (err) {
                  console.error('Direct download failed:', err);
                  alert('Download failed. Please try again.');
                }
              }}
              disabled={false}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors"
            >
              <Download className="w-5 h-5" />
              Download File
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
