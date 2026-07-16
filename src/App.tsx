import { useEffect, useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import { allocationService } from './lib/services/allocation.service';
import { uploadService } from './lib/services/upload.service';
import { downloadService } from './lib/services/download.service';
import { accountPoolService } from './lib/services/accountPool.service';
import { vfsService } from './lib/services/vfs.service';
import { initiateGoogleLogin } from './lib/googleAuth';
import { LogOut } from 'lucide-react';

import { BetterAuthForm } from './components/auth/BetterAuthForm';
import { authClient } from './lib/auth-client';
import { supabase } from './lib/services/supabaseClient';
import { Button } from './components/ui/Button';
import { Breadcrumbs, BreadcrumbItem } from './components/dashboard/Breadcrumbs';
import { FileExplorer } from './components/dashboard/FileExplorer';
import { StorageNodes, TransferTask } from './components/dashboard/StorageNodes';
import { ExecutiveDashboard } from './components/dashboard/ExecutiveDashboard';
import { UploadGateway } from './components/dashboard/UploadGateway';
import { AnonymousShareView } from './components/share/AnonymousShareView';

import { VFSNode, AppConfig, PooledAccount, isGoogleDriveRef, isTelegramRef, GoogleDriveRef, TelegramRef } from './types';

const Sidebar = ({
  activeUser,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  currentView,
  setCurrentView,
  setToastMessage,
  setDevSessionUser,
  setIsUserAuthenticated,
  setAccounts,
  allFlattenedNodes = []
}: any) => {

  const totalBytes = allFlattenedNodes.reduce((sum: number, n: any) => sum + (n.size || 0), 0);
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0.00 GB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      <div 
        className={`bg-slate-900 border-r border-slate-800 flex flex-col h-screen text-slate-300 fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        ${isSidebarCollapsed ? 'md:w-16' : 'md:w-64'} w-64`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between h-20">
          <div className="flex items-center gap-2 overflow-hidden">
            {activeUser?.image ? (
              <div className="relative w-8 h-8 shrink-0 rounded-md overflow-hidden bg-slate-800 flex items-center justify-center">
                <img 
                  src={activeUser.image} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.parentElement) {
                      const fallback = e.currentTarget.parentElement.querySelector('.fallback-initial');
                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                    }
                  }}
                />
                <span className="fallback-initial hidden text-white font-bold text-sm">
                  {(activeUser?.name || activeUser?.username || 'L').charAt(0).toUpperCase()}
                </span>
              </div>
            ) : (
              <div className="w-8 h-8 shrink-0 rounded-md bg-indigo-500 border border-indigo-400/30 text-white flex items-center justify-center font-bold text-sm">
                {(activeUser?.name || activeUser?.username || 'L').charAt(0).toUpperCase()}
              </div>
            )}

            <div className={`flex flex-col transition-opacity duration-300 ${isSidebarCollapsed ? 'md:opacity-0 md:w-0' : 'opacity-100'}`}>
              <h1 className="text-xl font-bold text-white tracking-tight whitespace-nowrap">Lukman Cloud</h1>
              <div className="flex gap-2 mt-1 items-center overflow-hidden">
                <span className="inline-flex text-[8px] font-mono font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 border border-emerald-400/20 rounded-full shrink-0">
                  VAULT UNLOCKED
                </span>
                <span className="inline-flex items-center text-slate-400 font-mono text-[10px] bg-slate-900/60 py-0.5 px-2 rounded-md border border-slate-800 truncate" title={`@${activeUser?.username || 'guest'}`}>
                  @{activeUser?.username || 'guest'}
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white"
          >
            {isSidebarCollapsed ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>
        
        <nav className="flex-1 flex flex-col gap-2 p-3 relative">
          {/* Active Indicator Pill */}
          <div 
            className="absolute left-3 right-3 h-[44px] bg-blue-500/10 border border-blue-500/20 rounded-lg transition-transform duration-300 ease-in-out pointer-events-none"
            style={{ 
              top: '12px',
              transform: currentView === 'dashboard' ? 'translateY(0px)' : 
                         currentView === 'vfs' ? 'translateY(52px)' : 
                         currentView === 'nodes' ? 'translateY(104px)' :
                         currentView === 'management' ? 'translateY(156px)' :
                         'translateY(104px)' // fallback
            }}
          />
          
          <button 
            onClick={() => { setCurrentView('dashboard'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium overflow-hidden group relative z-10
              ${currentView === 'dashboard' ? 'text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
            title="Dashboard"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className={`text-sm whitespace-nowrap transition-opacity duration-300 ${isSidebarCollapsed ? 'md:opacity-0 md:w-0' : 'opacity-100'}`}>Dashboard</span>
          </button>
          
          <button 
            onClick={() => { setCurrentView('vfs'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium overflow-hidden group relative z-10
              ${currentView === 'vfs' ? 'text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
            title="Virtual Storage"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className={`text-sm whitespace-nowrap transition-opacity duration-300 ${isSidebarCollapsed ? 'md:opacity-0 md:w-0' : 'opacity-100'}`}>Virtual Storage</span>
          </button>
          
          <button 
            onClick={() => { setCurrentView('nodes'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium overflow-hidden group relative z-10
              ${currentView === 'nodes' ? 'text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
            title="Storage Nodes"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className={`text-sm whitespace-nowrap transition-opacity duration-300 ${isSidebarCollapsed ? 'md:opacity-0 md:w-0' : 'opacity-100'}`}>Storage Nodes</span>
          </button>
          
        </nav>
        
        {/* Unlimited Storage Widget (Google Drive Style) */}
        {!isSidebarCollapsed && (
          <div className="px-4 py-4 mt-auto border-t border-slate-800">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  <span>Storage</span>
                </div>
              </div>
              {/* Minimalist horizontal progress bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-blue-500 rounded-full w-[2%] min-w-[4px]"></div>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {formatSize(totalBytes)} of Unlimited used
              </div>
            </div>
          </div>
        )}
        
        <div className="p-3 border-t border-slate-800">
          <button 
            className="flex w-full items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-medium border border-slate-700 overflow-hidden group"
            onClick={async () => {
              try {
                if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'mock') {
                  localStorage.removeItem('dev_session_user');
                  setDevSessionUser(null);
                  setToastMessage(null);
                  setIsUserAuthenticated(false);
                  setAccounts([]);
                  setCurrentView('auth');
                  window.location.reload();
                  return;
                }
                setToastMessage(null); // Purge global toasts on sign out
                try {
                  await authClient.signOut();
                } catch (e) {
                  console.warn('[SignOut] Network failed but proceeding locally:', e);
                }
              } catch (e) {
                console.warn('[SignOut] Backend unreachable or sign out failed:', e);
              } finally {
                setIsUserAuthenticated(false);
                setAccounts([]);
                setCurrentView('auth');
                if (import.meta.env.DEV) {
                  window.location.reload();
                }
              }
            }}
            title="Sign Out"
          >
            <LogOut className="w-5 h-5 shrink-0 text-rose-400 group-hover:text-rose-300 transition-colors" />
            <span className={`text-sm whitespace-nowrap transition-opacity duration-300 ${isSidebarCollapsed ? 'md:opacity-0 md:w-0 hidden md:inline' : 'opacity-100'}`}>Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default function App() {
  const [isUserAuthenticated, setIsUserAuthenticated] = useState<boolean>(false);
  const [activeUser, setActiveUser] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');
  const [devSessionUser, setDevSessionUser] = useState<any>(null);
  const [sharedNodeId, setSharedNodeId] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/share/')) {
      try {
        const encodedId = path.replace('/share/', '');
        const decodedId = atob(encodedId);
        setCurrentView('vfs');
        setSharedNodeId(decodedId);
      } catch (e) {
        console.error('Invalid share link', e);
      }
    }
  }, []);

  // Native Supabase Session Sync
  useEffect(() => {
    let mounted = true;

    // Check dev mock bypass first
    const checkMockBypass = () => {
      try {
        if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'mock') {
          const stored = localStorage.getItem('dev_session_user');
          if (stored) return JSON.parse(stored);
        }
      } catch {
        return null;
      }
      return null;
    };

    const processSession = async (session: any) => {
      if (!mounted) return;
      
      const mockUser = checkMockBypass();
      const currentUser = mockUser || session?.user;

      if (currentUser) {
        if (mockUser) {
          (window as any).__MOCK_SESSION_ID__ = currentUser.id;
        } else {
          // Map native Supabase user props for the UI
          currentUser.name = currentUser.user_metadata?.name;
          currentUser.username = currentUser.user_metadata?.username;
          currentUser.image = currentUser.user_metadata?.avatar_url;
        }

        try {
          if (!mockUser) {
            // Synchronize to public user table for foreign key constraints (vfs_nodes)
            // This resolves the 400 Bad Request error for all users
            await supabase.from('user').upsert({
              id: currentUser.id,
              name: currentUser.name || currentUser.email?.split('@')[0] || 'Unknown User',
              email: currentUser.email,
              username: currentUser.username || currentUser.email?.split('@')[0] || `user_${Date.now()}`,
              image: currentUser.image || null,
              emailVerified: true,
              createdAt: currentUser.createdAt || new Date().toISOString(),
              updatedAt: currentUser.updatedAt || new Date().toISOString()
            });


          }
        } catch (e) {
          console.error('Auto-link failed', e);
        }

        // Check onboarding guard for Google OAuth users ONLY (guests now auto-generate full names)
        if (!currentUser?.username) {
          setActiveUser(currentUser);
          setIsUserAuthenticated(true);
          setShowOnboarding(true);
          setSessionLoading(false);
        } else {
          setShowOnboarding(false);
          setActiveUser(currentUser);
          setIsUserAuthenticated(true);
          setSessionLoading(false);
        }
      } else {
        setActiveUser(null);
        setIsUserAuthenticated(false);
        setSessionLoading(false);
      }
    };

    // 1. Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      processSession(session);
    });

    // 2. Listen to state changes to break the routing loop
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session && localStorage.getItem('block_auto_login') === 'true') {
        // Prevent processing session during registration flow
        return;
      }
      processSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const appState = isUserAuthenticated ? 'unlocked' : 'auth';

  // Core Services State
  const [accounts, setAccounts] = useState<PooledAccount[]>([]);
  const workerPoolRef = useRef<Worker[]>([]);

  // Navigation State
  const [currentView, setCurrentView] = useState<'dashboard' | 'vfs' | 'nodes'>('vfs');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // VFS Explorer State
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [vfsNodes, setVfsNodes] = useState<VFSNode[]>([]);
  const [loadingFolder, setLoadingFolder] = useState<boolean>(false);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: 'root', name: 'My Drive' }]);

  // Quota & Transfers State
  const [activeTransfers, setActiveTransfers] = useState<TransferTask[]>([]);
  
  interface ActiveUpload {
    id: string;
    fileName: string;
    progress: number;
    status: 'uploading' | 'success' | 'error';
    errorMessage?: string;
  }
  const [activeUploadsTracker, setActiveUploadsTracker] = useState<Record<string, ActiveUpload>>({});

  interface DownloadProgressState {
    status: 'idle' | 'confirming' | 'decrypting' | 'success' | 'error';
    progress: number;
    fileName: string;
    errorMessage?: string;
    isMinimized?: boolean;
  }
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressState>({ status: 'idle', progress: 0, fileName: '', isMinimized: false });

  // ── Upload Routing State ───────────────────────────────────────────────────
  /** When true, each upload also runs a parallel mirror pass to Google Drive */
  const [gdriveMirrorEnabled, setGdriveMirrorEnabled] = useState(false);

  // Modal States
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [deleteModalNode, setDeleteModalNode] = useState<VFSNode | null>(null);
  const [moveModalNode, setMoveModalNode] = useState<VFSNode | null>(null);
  const [allFolders, setAllFolders] = useState<VFSNode[]>([]);


  // Search and Sort States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VFSNode[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [sortKey, setSortKey] = useState<'Alphabetical' | 'Last Modified' | 'File Size'>('Alphabetical');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isGridView, setIsGridView] = useState(true);
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{title: string, message: string, type: 'success' | 'error' | 'info'} | null>(null);
  
  const newMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(event.target as Node)) {
        setIsNewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNativeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  useEffect(() => {
    return () => {
      workerPoolRef.current.forEach(w => {
        w.postMessage({ type: 'DISCONNECT' });
        w.terminate();
      });
      workerPoolRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (activeUser) {
      accountPoolService.getPool().then(pool => setAccounts(pool)).catch(console.warn);
    }
  }, [activeUser]);

  const [allFlattenedNodes, setAllFlattenedNodes] = useState<VFSNode[]>([]);

  useEffect(() => {
    if (sharedNodeId && allFlattenedNodes.length > 0) {
      const node = allFlattenedNodes.find(n => n.id === sharedNodeId);
      if (node) {
        if (node.type === 'folder') {
          handleNavigateFolder(node.id);
        } else if (node.type === 'file') {
          handleNavigateFolder(node.parentId);
          // Auto preview will be triggered by FileExplorer prop
        }
        setSharedNodeId(null);
      }
    }
  }, [sharedNodeId, allFlattenedNodes]);

  // Load VFS Directory
  const loadDirectory = async (folderId: string) => {
    setLoadingFolder(true);
    try {
      // Crawl the entire global VFS registry for the dashboard metrics
      const globalRegistry = await vfsService.loadRegistry();
      setAllFlattenedNodes(globalRegistry);
      
      // Filter for the specific VFS viewport
      const nodes = globalRegistry.filter(n => n.parentId === folderId);
      setVfsNodes(nodes);
    } catch (err) {
      console.error('[App] Load directory error:', err);
    } finally {
      setLoadingFolder(false);
    }
  };

  useEffect(() => {
    if (appState === 'unlocked' && currentView === 'vfs') {
      loadDirectory(currentFolderId);
    }
  }, [appState, currentFolderId, currentView]);

  // Trigger quota fetch when accounts are ready
  useEffect(() => {
    if (accounts.length > 0) {
      Promise.all(accounts.map(acc => allocationService.fetchAccountQuota(acc, true)))
        .then(updatedAccounts => setAccounts(updatedAccounts))
        .catch(err => console.error('[App] Pool quota fetch error:', err));
    }
  }, [accounts.length]); 

  // Search Logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const results = allFlattenedNodes.filter(node => node.name.toLowerCase().includes(query));
    setSearchResults(results);
  }, [searchQuery, allFlattenedNodes]);

  // VFS Navigation
  const handleNavigateFolder = (folderId: string) => {
    if (folderId === 'root') {
      setCurrentFolderId('root');
      setBreadcrumbs([{ id: 'root', name: 'My Drive' }]);
      return;
    }
    const folderNode = allFlattenedNodes.find(n => n.id === folderId);
    if (folderNode && folderNode.type === 'folder') {
      setCurrentFolderId(folderId);
      
      // Compute full breadcrumb path
      const newBreadcrumbs = [];
      let current: any = folderNode;
      while (current && current.id !== 'root') {
        newBreadcrumbs.unshift({ id: current.id, name: current.name });
        current = allFlattenedNodes.find(n => n.id === current.parentId);
      }
      setBreadcrumbs([{ id: 'root', name: 'My Drive' }, ...newBreadcrumbs]);
    }
  };

  const handleBreadcrumbNavigate = (id: string) => {
    setCurrentFolderId(id);
    const index = breadcrumbs.findIndex(b => b.id === id);
    if (index !== -1) {
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    }
  };

  // ── Upload Logic (Telegram-Primary, GDrive Optional Mirror) ───────────────
  const handleUploadFiles = async (files: File[]) => {

    // Ensure the Telegram worker is warm
    if (workerPoolRef.current.length === 0) {
      const BOT_POOL = [
        import.meta.env.VITE_TELEGRAM_BOT_TOKEN_P,
        import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W1,
        import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W2,
        import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W3,
        import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W4,
        import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W5
      ].filter(Boolean) as string[];
      
      if (BOT_POOL.length === 0) {
        console.error('[App] Critical: No VITE_TELEGRAM_BOT_TOKEN environment variables found.');
        throw new Error('Storage Nodes Offline: Missing Telegram Bot Tokens');
      }
      const workers = BOT_POOL.map(token => {
        const w = new Worker(new URL('./workers/telegram.worker.ts', import.meta.url), { type: 'module' });
        w.onerror = (e) => {
          e.preventDefault();
          console.error('[Worker] Fatal error:', e.message);
        };
        w.postMessage({
          type: 'CONNECT',
          apiId: 35691342,
          apiHash: '84d8f1a2c0e9c4c09cff23316db186ec',
          botToken: token
        });
        return w;
      });
      workerPoolRef.current = workers;
    }

    const ensurePathExists = async (pathStr: string, rootFolderId: string): Promise<string> => {
      if (!pathStr || pathStr === '') return rootFolderId;
      const parts = pathStr.split('/');
      // The last part is the filename, we only want directories
      parts.pop(); 
      if (parts.length === 0) return rootFolderId;

      let currentId = rootFolderId;
      for (const part of parts) {
        const folders = await vfsService.getAllFolders();
        let existing = folders.find(f => f.parentId === currentId && f.name === part);
        if (!existing) {
          existing = await vfsService.createFolder(part, currentId);
        }
        currentId = existing.id;
      }
      return currentId;
    };

    for (const file of files) {
      const txId = crypto.randomUUID();
      setActiveTransfers(prev => [...prev, { id: txId, name: file.name, status: 'Routing...', progress: 0 }]);
      setActiveUploadsTracker(prev => ({
        ...prev,
        [txId]: { id: txId, fileName: file.name, progress: 0, status: 'uploading' }
      }));

      try {
        // ── PRIMARY: Telegram Unlimited Storage ─────────────────────────────
        setActiveTransfers(prev => prev.map(t =>
          t.id === txId ? { ...t, status: 'Streaming to Cloud Core...' } : t
        ));

        const tgRef = await uploadService.uploadToTelegram(
          file,
          '', // overridden internally by routing matrix
          workerPoolRef.current,
          (progress, speedText) => {
            const pct = Math.min(100, Math.max(0, progress * 100));
            const displayStatus = speedText ? `Cloud Core — ${pct.toFixed(0)}% • ${speedText}` : `Cloud Core — ${pct.toFixed(0)}%`;
            setActiveTransfers(prev => prev.map(t =>
              t.id === txId ? { ...t, status: displayStatus, progress: pct } : t
            ));
            setActiveUploadsTracker(prev => ({
              ...prev,
              [txId]: { ...prev[txId], progress: pct }
            }));
          }
        );

        const targetParentId = await ensurePathExists(file.webkitRelativePath, currentFolderId);

        const newFileNode = await vfsService.addFile({
          id: crypto.randomUUID(),
          name: file.name,
          type: 'file',
          path: '',
          parentId: targetParentId,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          storageRef: { 
            provider: 'telegram', 
            channel_id: (tgRef as TelegramRef).channelId,
            message_id: (tgRef as TelegramRef).chunks[0]?.messageId,
            fileId: (tgRef as TelegramRef).channelId
          },
          rawRef: tgRef as TelegramRef,
          telegramChannelId: (tgRef as TelegramRef).channelId
        });

        // Force-refresh VFS registry so new files appear instantly in UI
        await loadDirectory(currentFolderId);

        // ── SECONDARY: Google Drive Mirror (if toggle is ON) ─────────────────
        if (gdriveMirrorEnabled && accounts.length > 0) {
          try {
            const mirrorAccount = allocationService.selectBestAccount(accounts, file.size) || accounts[0];
            setActiveTransfers(prev => prev.map(t =>
              t.id === txId ? { ...t, status: `Mirroring to Google Drive...` } : t
            ));
            await uploadService.uploadToGoogleDrive(file, mirrorAccount);
            console.info(`[Mirror] ${file.name} backed up to Google Drive (${mirrorAccount.email})`);
          } catch (mirrorErr: any) {
            // Mirror failure is non-fatal — primary upload already succeeded
            console.warn('[Mirror] GDrive backup failed (non-fatal):', mirrorErr.message);
          }
        }

        setActiveTransfers(prev => prev.map(t =>
          t.id === txId ? { ...t, status: 'Complete', progress: 100 } : t
        ));
        setActiveUploadsTracker(prev => ({
          ...prev,
          [txId]: { ...prev[txId], status: 'success', progress: 100 }
        }));
        setTimeout(() => {
          setActiveUploadsTracker(prev => {
            const allSuccess = Object.values(prev).every(u => u.status === 'success');
            return allSuccess ? {} : prev;
          });
        }, 4000);
        setTimeout(() => setActiveTransfers(prev => prev.filter(t => t.id !== txId)), 3000);

      } catch (err: any) {
        console.error('[Upload] Telegram pipeline failed:', err);
        setActiveTransfers(prev => prev.map(t =>
          t.id === txId ? { ...t, status: `Error: ${err.message}` } : t
        ));
        setActiveUploadsTracker(prev => ({
          ...prev,
          [txId]: { ...prev[txId], status: 'error', errorMessage: err.message }
        }));
        setToastMessage({ title: 'Upload Failed', message: `Failed to upload ${file.name}: ${err.message}`, type: 'error' });
        setTimeout(() => setToastMessage(null), 4000);
      }
    }
  };

  const handleGetFileUrl = async (fileNode: VFSNode): Promise<string> => {
    if (accounts.length === 0 && !isTelegramRef(fileNode.rawRef as any)) {
      throw new Error('No accounts configured for Google Drive node');
    }
    const txId = crypto.randomUUID();
    setActiveTransfers(prev => [...prev, { id: txId, name: `Fetching ${fileNode.name}`, status: 'Downloading...', progress: 0 }]);
    setDownloadProgress({ status: 'decrypting', progress: 0, fileName: fileNode.name });

    try {
      let blobUrl: string;
      let ref = fileNode.rawRef;
      
      // Fallback: gracefully handle missing rawRef or provider
      if (!ref || (!isGoogleDriveRef(ref as any) && !isTelegramRef(ref as any))) {
        if (fileNode.storageRef?.provider === 'gdrive' || fileNode.storageRef?.fileId) {
          ref = {
            provider: 'google_drive',
            accountId: fileNode.storageRef?.accountId || accounts[0]?.id,
            fileId: fileNode.storageRef?.fileId || '',
            mimeType: fileNode.mimeType || ''
          } as any;
        } else if (fileNode.storageRef?.provider === 'telegram' || fileNode.storageRef?.message_id) {
          ref = {
            provider: 'telegram',
            channel_id: fileNode.storageRef?.channel_id || fileNode.telegramChannelId || '',
            message_id: fileNode.storageRef?.message_id || 0
          } as any;
        } else {
          throw new Error('Unknown storage provider reference');
        }
      }

        if (isGoogleDriveRef(ref as any)) {
          const accountId = ref.accountId;
          let targetAccount = accounts.find(a => a.id === accountId) || accounts[0];
          
          try {
            blobUrl = await downloadService.downloadFromGoogleDrive(ref, targetAccount.accessToken, (progress) => {
              setActiveTransfers(prev => prev.map(t => t.id === txId ? { ...t, progress: progress * 100 } : t));
              setDownloadProgress(prev => ({ ...prev, progress: progress * 100 }));
            }, fileNode.mimeType);
          } catch (err: any) {
            if (err.message && err.message.includes('HTTP 401') && targetAccount.refreshToken) {
              console.warn('[App] 401 Unauthenticated - Triggering silent OAuth token refresh');
              const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
              
              const res = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  client_id: clientId,
                  grant_type: 'refresh_token',
                  refresh_token: targetAccount.refreshToken,
                })
              });
              const data = await res.json();
              if (!res.ok) throw new Error('Token refresh failed: ' + (data.error_description || data.error));
              
              targetAccount = {
                ...targetAccount,
                accessToken: data.access_token,
                expiresAt: Date.now() + (data.expires_in * 1000)
              };
              
              setAccounts(prev => {
                const updated = accountPoolService.addOrUpdateAccount(prev, targetAccount);
                accountPoolService.savePool(updated).catch(e => console.error('Failed to save refreshed pool', e));
                return updated;
              });
              
              // Retry stream
              blobUrl = await downloadService.downloadFromGoogleDrive(ref, targetAccount.accessToken, (progress) => {
                setActiveTransfers(prev => prev.map(t => t.id === txId ? { ...t, progress: progress * 100 } : t));
                setDownloadProgress(prev => ({ ...prev, progress: progress * 100 }));
              }, fileNode.mimeType);
            } else {
              throw err;
            }
          }
        } else if (isTelegramRef(ref as any)) {
          if (workerPoolRef.current.length === 0) {
            console.warn('[App] Telegram worker pool not connected. Lazy-warming up MTProto pipeline...');
            const BOT_POOL = [
              import.meta.env.VITE_TELEGRAM_BOT_TOKEN_P,
              import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W1,
              import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W2,
              import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W3,
              import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W4,
              import.meta.env.VITE_TELEGRAM_BOT_TOKEN_W5
            ].filter(Boolean) as string[];
            
            if (BOT_POOL.length === 0) {
              console.error('[App] Critical: No VITE_TELEGRAM_BOT_TOKEN environment variables found.');
              throw new Error('Storage Nodes Offline: Missing Telegram Bot Tokens');
            }
            const workers = BOT_POOL.map(token => {
              const w = new Worker(new URL('./workers/telegram.worker.ts', import.meta.url), { type: 'module' });
              w.onerror = (e) => {
                e.preventDefault();
                setActiveTransfers(prev => prev.map(t => t.id === txId ? { ...t, status: `Error: Worker crashed` } : t));
              };
              w.postMessage({ 
                type: 'CONNECT', 
                apiId: 35691342, 
                apiHash: '84d8f1a2c0e9c4c09cff23316db186ec',
                botToken: token
              });
              return w;
            });
            workerPoolRef.current = workers;
            
            // Allow 500ms for immediate synchronous readiness (MTProto usually caches session internally)
            await new Promise(r => setTimeout(r, 500));
          }
          
          blobUrl = await downloadService.downloadFromTelegram(ref, workerPoolRef.current, (progress, speedText) => {
            const displayStatus = speedText ? `Downloading (core node) • ${speedText}` : `Downloading (core node)`;
            setActiveTransfers(prev => prev.map(t => t.id === txId ? { ...t, status: displayStatus, progress: progress * 100 } : t));
            setDownloadProgress(prev => ({ ...prev, progress: progress * 100 }));
          }, fileNode.mimeType, fileNode.telegramChannelId);
        } else {
          throw new Error('Unknown storage provider reference (post-fallback)');
        }

      setActiveTransfers(prev => prev.map(t => t.id === txId ? { ...t, status: 'Complete', progress: 100 } : t));
      setDownloadProgress(prev => ({ ...prev, status: 'success', progress: 100 }));
      
      setTimeout(() => setDownloadProgress(prev => prev.status === 'success' ? { status: 'idle', progress: 0, fileName: '' } : prev), 3000);
      setTimeout(() => setActiveTransfers(prev => prev.filter(t => t.id !== txId)), 3000);
      
      return blobUrl;
    } catch (err: any) {
      console.error('[Fetch] Failed:', err);
      setActiveTransfers(prev => prev.map(t => t.id === txId ? { ...t, status: `Error: ${err.message}` } : t));
      setDownloadProgress(prev => ({ ...prev, status: 'error', errorMessage: err.message }));
      throw err;
    }
  };

  const handleDownloadFile = async (fileNode: VFSNode) => {
    try {
      const blobUrl = await handleGetFileUrl(fileNode);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileNode.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      // Error is handled and displayed by the fetcher
    }
  };



  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-mono text-sm tracking-tight">Authenticating Session...</p>
        </div>
      </div>
    );
  }

  if (showOnboarding && isUserAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>
        
        <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-[scaleIn_0.3s_ease-out]">
          <div className="bg-slate-800/60 backdrop-blur-xl py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-slate-700/50">
            <h3 className="text-xl font-bold text-white mb-6 text-center">Choose your unique username to activate your storage account</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setOnboardingLoading(true);
              setOnboardingError('');
              try {
                if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'mock') {
                  const LOCAL_DB_KEY = 'lukman_cloud_mock_users_db';
                  const users = JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || '[]');
                  const lowerUsername = newUsername.toLowerCase();
                  if (users.find((u: any) => u.username === lowerUsername)) {
                    throw new Error("This username is already registered in the system infrastructure.");
                  }
                  
                  // Update current user in mock DB if exists, else we just proceed
                  const userIndex = users.findIndex((u: any) => u.id === devSessionUser?.id);
                  if (userIndex !== -1) {
                    users[userIndex].username = lowerUsername;
                  } else if (devSessionUser) {
                    users.push({ ...devSessionUser, username: lowerUsername });
                  }
                  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(users));
                  
                  const updatedDevUser = { ...devSessionUser, username: lowerUsername };
                  localStorage.setItem('dev_session_user', JSON.stringify(updatedDevUser));
                  setDevSessionUser(updatedDevUser);
                  setShowOnboarding(false);
                  setIsUserAuthenticated(true);
                  setOnboardingLoading(false);
                  return;
                }
                
                // 1. Update native Supabase user metadata
                const { error: metaErr } = await supabase.auth.updateUser({
                  data: { username: newUsername }
                });
                if (metaErr) throw metaErr;

                // 2. Synchronize to public user table for foreign key constraints (vfs_nodes)
                const { error: dbErr } = await supabase.from('user').upsert({
                  id: activeUser.id,
                  name: activeUser.name || 'Guest User',
                  email: activeUser.email || `${newUsername}@lukmancloud.local`,
                  username: newUsername,
                  image: activeUser.image || null,
                  emailVerified: true,
                  createdAt: activeUser.createdAt || new Date().toISOString(),
                  updatedAt: activeUser.updatedAt || new Date().toISOString()
                });
                if (dbErr) throw dbErr;

                window.location.reload();
              } catch (err: any) {
                setOnboardingError(err.message || 'Failed to save username');
              } finally {
                setOnboardingLoading(false);
              }
            }}>
              <input type="text" required value={newUsername} onChange={e => setNewUsername(e.target.value.toLowerCase())} placeholder="Enter a username..." className="appearance-none block w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg shadow-sm placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6" />
              
              <button type="submit" disabled={onboardingLoading} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all shadow-md w-full">
                {onboardingLoading ? 'Saving...' : 'Activate Storage Account'}
              </button>
              
              {onboardingError && <div className="text-red-500 text-sm mt-4 text-center">{onboardingError}</div>}
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (!isUserAuthenticated) {
    if (sharedNodeId) {
      return <AnonymousShareView sharedNodeId={sharedNodeId} />;
    }
    return <BetterAuthForm onDevBypass={(user) => {
      if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'mock') {
        localStorage.setItem('dev_session_user', JSON.stringify(user));
        setDevSessionUser(user);
      }
    }} />;
  }
  
  return (
    <div className="flex flex-col min-h-dvh bg-slate-50 font-sans">
      {/* Mobile Header Topbar */}
      <div className="md:hidden flex items-center h-14 bg-slate-900 border-b border-slate-800 px-4 shrink-0">
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 text-slate-400 hover:text-white focus:outline-none"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="ml-3 font-bold text-white tracking-tight flex items-center gap-2 text-lg">
          <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          Lukman Cloud
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar
          activeUser={activeUser}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          currentView={currentView}
          setCurrentView={setCurrentView}
          setToastMessage={setToastMessage}
          setDevSessionUser={setDevSessionUser}
          setIsUserAuthenticated={setIsUserAuthenticated}
          setAccounts={setAccounts}
          allFlattenedNodes={allFlattenedNodes}
        />
        <main className={`flex-1 overflow-y-auto transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'md:ml-[68px]' : 'md:ml-64'} ml-0 bg-white flex flex-col`}>
          <div className="w-full max-w-7xl mx-auto space-y-6 px-4 md:px-8 py-4 md:py-6">
          {currentView === 'dashboard' && (
            <div className="flex flex-col gap-6 w-full animate-[fadeIn_0.3s_ease-out]">
              <div className="w-full">
                <ExecutiveDashboard 
                  accounts={accounts}
                  activeTransfers={activeTransfers}
                  vfsNodes={allFlattenedNodes}
                />
              </div>
            </div>
          )}

          {currentView === 'vfs' && (
            <div className="flex flex-col gap-6">
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                Cloud Storage Core Engine
              </h2>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Hidden File Inputs */}
                <input 
                  type="file" 
                  multiple 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={(e) => e.target.files && handleUploadFiles(Array.from(e.target.files))}
                />
                <input 
                  type="file" 
                  multiple 
                  {...({ webkitdirectory: "", directory: "" } as any)} 
                  className="hidden" 
                  ref={folderInputRef} 
                  onChange={(e) => e.target.files && handleUploadFiles(Array.from(e.target.files))}
                />
                
                {/* Mirror Mirror — GDrive Backup Toggle */}
                <button
                  onClick={() => setGdriveMirrorEnabled(prev => !prev)}
                  disabled={accounts.length === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border font-semibold text-sm transition-all shadow-sm ${
                    accounts.length === 0 
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                      : gdriveMirrorEnabled
                        ? 'bg-blue-600 border-blue-600 text-white shadow-blue-200'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                  }`}
                  title={accounts.length === 0 ? "Please connect an active account under Node Management first." : gdriveMirrorEnabled ? 'Google Drive mirroring is ON' : 'Enable Google Drive mirror backup'}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 87.3 78" fill="currentColor">
                    <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill={gdriveMirrorEnabled ? '#fff' : '#0066DA'}/>
                    <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.5c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill={gdriveMirrorEnabled ? '#fff' : '#00AC47'}/>
                    <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.85l5.9 11.5z" fill={gdriveMirrorEnabled ? '#fff' : '#EA4335'}/>
                    <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill={gdriveMirrorEnabled ? '#fff' : '#00832D'}/>
                    <path d="M59.85 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill={gdriveMirrorEnabled ? '#fff' : '#2684FC'}/>
                    <path d="M73.4 26.5l-12.6-21.8c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.2 28H87.3c0-1.55-.4-3.1-1.2-4.5z" fill={gdriveMirrorEnabled ? '#fff' : '#FFBA00'}/>
                  </svg>
                  <span>Mirror Backup to Google Drive</span>
                  <div className={`ml-1 w-8 h-4 rounded-full transition-colors relative ${accounts.length === 0 ? 'bg-slate-200' : gdriveMirrorEnabled ? 'bg-white/40' : 'bg-slate-200'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${gdriveMirrorEnabled && accounts.length > 0 ? 'left-4' : 'left-0.5'}`}></div>
                  </div>
                </button>
              </div>
              
              {/* The sorting logic block */}
              {(() => {
                const sortedNodes = [...vfsNodes].sort((a, b) => {
                  let comparison = 0;
                  if (sortKey === 'Alphabetical') {
                    comparison = a.name.localeCompare(b.name);
                  } else if (sortKey === 'Last Modified') {
                    comparison = new Date(a.modifiedAt || '').getTime() - new Date(b.modifiedAt || '').getTime();
                  } else if (sortKey === 'File Size') {
                    comparison = (a.size || 0) - (b.size || 0);
                  }
                  return sortDirection === 'asc' ? comparison : -comparison;
                });

                return (
                    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto animate-[fadeIn_0.3s_ease-out]">
                      <div className="flex items-center gap-4">
                        {/* + New Button Dropdown */}
                        <div className="relative shrink-0" ref={newMenuRef}>
                          <button
                            onClick={() => setIsNewMenuOpen(prev => !prev)}
                            className="bg-blue-600 hover:bg-blue-700 text-white pl-4 pr-5 py-2.5 rounded-full font-medium shadow-sm hover:shadow transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            New
                          </button>
                          
                          {isNewMenuOpen && (
                            <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 py-2 animate-[scaleIn_0.1s_ease-out]">
                              <button 
                                onClick={() => {
                                  setNewFolderName('');
                                  setNewFolderModalOpen(true);
                                  setIsNewMenuOpen(false);
                                }}
                                className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors text-slate-700 font-medium"
                              >
                                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                                </svg>
                                New Folder
                              </button>
                              <div className="h-px bg-slate-100 my-1 w-full" />
                              <button 
                                onClick={() => {
                                  fileInputRef.current?.click();
                                  setIsNewMenuOpen(false);
                                }}
                                className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors text-slate-700 font-medium"
                              >
                                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                File Upload
                              </button>
                              <button 
                                onClick={() => {
                                  folderInputRef.current?.click();
                                  setIsNewMenuOpen(false);
                                }}
                                className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors text-slate-700 font-medium"
                              >
                                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                Folder Upload
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Search Bar - Streamlined into Toolbar */}
                        <div className="flex-1 relative group">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                            <svg className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                          <input 
                            type="text" 
                            placeholder="Search files and folders..." 
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setActiveSuggestionIndex(-1);
                            }}
                            onKeyDown={(e) => {
                              if (!isSearchFocused || searchResults.length === 0) return;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setActiveSuggestionIndex(prev => prev < searchResults.length - 1 ? prev + 1 : prev);
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setActiveSuggestionIndex(prev => prev > 0 ? prev - 1 : 0);
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (activeSuggestionIndex >= 0 && activeSuggestionIndex < searchResults.length) {
                                  const result = searchResults[activeSuggestionIndex];
                                  flushSync(() => {
                                    setSearchQuery('');
                                    const targetFolder = result.type === 'folder' ? result.id : (result.parentId || 'root');
                                    setCurrentFolderId(targetFolder);
                                    setCurrentView('vfs');
                                    if (result.type !== 'folder') {
                                      setHighlightedNodeId(result.id);
                                    }
                                    setIsSearchFocused(false);
                                    setActiveSuggestionIndex(-1);
                                  });
                                  if (result.type !== 'folder') {
                                    setTimeout(() => setHighlightedNodeId(null), 3000);
                                  }
                                }
                              }
                            }}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                            className="w-full bg-slate-100 hover:bg-slate-200/60 focus:bg-white text-slate-800 placeholder-slate-500 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border focus:border-blue-300 border border-transparent pl-11 pr-4 py-2.5 transition-all"
                          />
                          
                          {/* Search Results Dropdown */}
                          {isSearchFocused && searchQuery.trim() !== '' && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 max-h-96 overflow-y-auto">
                              {searchResults.length === 0 ? (
                                <div className="p-4 text-center text-sm text-slate-500">No results found for "{searchQuery}"</div>
                              ) : (
                                <div className="py-2">
                                  {searchResults.map((result, index) => (
                                    <div 
                                      key={result.id} 
                                      className={`px-4 py-3 cursor-pointer flex items-center gap-3 transition-colors ${activeSuggestionIndex === index ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                      onClick={() => {
                                        flushSync(() => {
                                          setSearchQuery('');
                                          const targetFolder = result.type === 'folder' ? result.id : (result.parentId || 'root');
                                          setCurrentFolderId(targetFolder);
                                          setCurrentView('vfs');
                                          if (result.type !== 'folder') {
                                            setHighlightedNodeId(result.id);
                                          }
                                          setIsSearchFocused(false);
                                          setActiveSuggestionIndex(-1);
                                        });
                                        if (result.type !== 'folder') {
                                          setTimeout(() => setHighlightedNodeId(null), 3000);
                                        }
                                      }}
                                    >
                                      <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center shrink-0">
                                        {result.type === 'folder' ? (
                                          <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                                        ) : (
                                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                        )}
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-medium text-slate-700 truncate">{result.name}</span>
                                        <span className="text-[11px] text-slate-400 truncate">
                                          Cloud Root {result.path.replace(`/${result.name}`, '').replace(/\//g, ' > ')}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Filter & View Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <select 
                            value={sortKey}
                            onChange={(e) => setSortKey(e.target.value as any)}
                            className="hidden md:block bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 py-2.5 pl-3 pr-8 outline-none cursor-pointer"
                          >
                            <option>Alphabetical</option>
                            <option>Last Modified</option>
                            <option>File Size</option>
                          </select>
                          <button 
                            onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                            className="p-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
                          >
                            {sortDirection === 'asc' ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            )}
                          </button>
                          <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-1 ml-2">
                            <button 
                              onClick={() => setIsGridView(true)}
                              className={`p-1.5 rounded transition-colors ${isGridView ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                            </button>
                            <button 
                              onClick={() => setIsGridView(false)}
                              className={`p-1.5 rounded transition-colors ${!isGridView ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="w-full">
                        <Breadcrumbs 
                          path={breadcrumbs} 
                          onNavigate={handleBreadcrumbNavigate} 
                        />
                      </div>

                      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 min-h-[500px]">
                      <FileExplorer 
                        nodes={sortedNodes}
                        loading={loadingFolder}
                        isGridView={isGridView}
                        highlightedNodeId={highlightedNodeId}
                        onNavigateFolder={handleNavigateFolder}
                        onDownloadFile={handleDownloadFile}
                        onFetchPreviewUrl={handleGetFileUrl}
                        onDeleteNode={(node) => setDeleteModalNode(node)}
                  onMoveNode={async (node) => {
                    setMoveModalNode(node);
                    const folders = await vfsService.getAllFolders();
                    setAllFolders(folders);
                  }}
                  onCopyNode={async (node, targetFolderId) => {
                    try {
                      await vfsService.copyNode(node.id, targetFolderId || 'root');
                      loadDirectory(currentFolderId);
                    } catch (e: any) {
                      setToastMessage({ title: 'Error', message: e.message, type: 'error' });
                      setTimeout(() => setToastMessage(null), 4000);
                    }
                  }}
                  onRenameNode={async (node, newName) => {
                    try {
                      await vfsService.renameNode(node.id, newName);
                      loadDirectory(currentFolderId);
                    } catch (e: any) {
                      setToastMessage({ title: 'Error', message: e.message, type: 'error' });
                      setTimeout(() => setToastMessage(null), 4000);
                    }
                  }}
                  onMoveToFolder={async (nodeId, targetFolderId) => {
                     try {
                       await vfsService.moveNode(nodeId, targetFolderId);
                       loadDirectory(currentFolderId);
                     } catch(e: any) {
                       setToastMessage({ title: 'Error', message: e.message, type: 'error' });
                       setTimeout(() => setToastMessage(null), 4000);
                     }
                  }}
                />
              </div>
            </div>
          );
        })()}
            </div>
          )}

          {currentView === 'nodes' && (
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Storage Nodes</h2>
              </div>
              <div className="w-full">
                <StorageNodes 
                  accounts={accounts}
                  vfsNodes={allFlattenedNodes}
                  onAddAccount={() => {
                    initiateGoogleLogin(
                      async (data) => {
                        const newAcc: PooledAccount = {
                          id: crypto.randomUUID(),
                          email: data.email,
                          accessToken: data.accessToken,
                          expiresAt: data.expiresAt,
                          usedQuota: 0,
                          totalQuota: 0
                        };
                        const updatedPool = accountPoolService.addOrUpdateAccount(accounts, newAcc);
                        await accountPoolService.savePool(updatedPool);
                        setAccounts(updatedPool);
                      },
                      (err) => console.error('[App] Pool Login failed:', err),
                      false
                    );
                  }}
                  activeTransfers={[]}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODALS */}
      
      {/* New Folder Modal */}
      {newFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Create New Folder</h3>
              <input 
                type="text" 
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder Name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && newFolderName.trim()) {
                    await vfsService.createFolder(newFolderName.trim(), currentFolderId);
                    loadDirectory(currentFolderId);
                    setNewFolderModalOpen(false);
                  }
                }}
              />
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <Button variant="default" onClick={() => setNewFolderModalOpen(false)}>Cancel</Button>
              <Button 
                variant="primary" 
                disabled={!newFolderName.trim()}
                onClick={async () => {
                  if (newFolderName.trim()) {
                    await vfsService.createFolder(newFolderName.trim(), currentFolderId);
                    loadDirectory(currentFolderId);
                    setNewFolderModalOpen(false);
                  }
                }}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Delete {deleteModalNode.type === 'folder' ? 'Folder' : 'File'}</h3>
              <p className="text-sm text-slate-500">
                Are you sure you want to delete <span className="font-semibold text-slate-700">{deleteModalNode.name}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <Button variant="default" onClick={() => setDeleteModalNode(null)}>Cancel</Button>
              <Button 
                variant="primary" 
                className="!bg-rose-600 hover:!bg-rose-700 focus:!ring-rose-500"
                onClick={async () => {
                  const node = deleteModalNode;
                  setDeleteModalNode(null);
                  
                  await vfsService.deleteNode(node.id);
                  loadDirectory(currentFolderId);
                  
                  // Handle physical deletion based on provider
                  if (node.type === 'file' && node.rawRef) {
                    try {
                      if (isGoogleDriveRef(node.rawRef as any)) {
                        const ref = node.rawRef as GoogleDriveRef;
                        const acc = accounts.find(a => a.id === ref.accountId) || accounts[0];
                        await fetch(`https://www.googleapis.com/drive/v3/files/${ref.driveFileId}`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${acc.accessToken}` }
                        });
                      } else if (isTelegramRef(node.rawRef as any)) {
                        // Send raw RPC delete task to worker
                      }
                    } catch (e) {
                      console.error('[VFS] Remote physical delete failed', e);
                    }
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Move Visual Picker Modal */}
      {moveModalNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-bold text-slate-800">Move {moveModalNode.name}</h3>
              <p className="text-sm text-slate-500 mt-1">Select a destination folder.</p>
            </div>
            <div className="overflow-y-auto p-2 bg-slate-50 flex-1">
              {allFolders.filter(f => f.id !== moveModalNode.id).length === 0 ? (
                <div className="text-center p-8 text-sm text-slate-500">No other folders available.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {allFolders
                    .filter(f => f.id !== moveModalNode.id && !f.path.startsWith(moveModalNode.path + '/'))
                    .sort((a, b) => a.path.localeCompare(b.path))
                    .map(folder => {
                      const depth = folder.path === '/' ? 0 : (folder.path.match(/\//g) || []).length;
                      return (
                        <button
                          key={folder.id}
                          onClick={async () => {
                            try {
                              await vfsService.moveNode(moveModalNode.id, folder.id);
                              loadDirectory(currentFolderId);
                              setMoveModalNode(null);
                            } catch (e: any) {
                              setToastMessage({ title: 'Error', message: e.message, type: 'error' });
                              setTimeout(() => setToastMessage(null), 4000);
                            }
                          }}
                          style={{ paddingLeft: `${depth * 1.5 + 0.75}rem`, paddingRight: '0.75rem', paddingTop: '0.75rem', paddingBottom: '0.75rem' }}
                          className="flex items-center gap-3 w-full text-left hover:bg-white rounded-lg border border-transparent hover:border-slate-200 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <span className="text-2xl shrink-0 opacity-70">
                            {depth === 0 ? '🗄️' : '📁'}
                          </span>
                          <div className="truncate">
                            <div className="font-semibold text-slate-700 text-sm truncate">{folder.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{folder.path}</div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end shrink-0">
              <Button variant="default" onClick={() => setMoveModalNode(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Upload Progress Telemetry */}
      {Object.keys(activeUploadsTracker).length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl animate-[fadeIn_0.3s_ease-out] flex flex-col gap-4 max-h-64 overflow-y-auto custom-scrollbar">
          {Object.values(activeUploadsTracker).map(upload => (
            <div key={upload.id} className="border-b border-slate-800/50 pb-3 last:border-0 last:pb-0">
              <div className="flex justify-between items-start mb-2">
                <div className="truncate pr-4 flex-1">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {upload.status === 'uploading' && 'Active Upload'}
                    {upload.status === 'success' && 'Upload Complete'}
                    {upload.status === 'error' && 'Upload Failed'}
                  </div>
                  <div className="text-sm font-semibold text-white truncate" title={upload.fileName}>
                    {upload.fileName}
                  </div>
                </div>
                {upload.status === 'error' && (
                  <button 
                    onClick={() => setActiveUploadsTracker(prev => {
                      const next = { ...prev };
                      delete next[upload.id];
                      return next;
                    })}
                    className="text-slate-400 hover:text-white shrink-0 p-1 bg-slate-800 rounded-full focus:outline-none"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              
              {upload.status === 'error' ? (
                <div className="text-xs font-mono text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20 mt-2 break-words max-h-32 overflow-y-auto">
                  {upload.errorMessage}
                </div>
              ) : (
                <div className="flex items-center gap-3 mt-3">
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className={`h-full transition-all duration-300 ${upload.status === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]'}`}
                      style={{ width: `${Math.min(upload.progress, 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold w-9 text-right ${upload.status === 'success' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                    {Math.round(upload.progress)}%
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Floating Download Progress Telemetry (Top-Right) */}
      {downloadProgress.status !== 'idle' && (
        downloadProgress.isMinimized ? (
          <div className="fixed top-4 right-4 z-50 bg-slate-900 border border-indigo-500/30 p-2 rounded-full shadow-2xl animate-bounce flex items-center gap-3 pr-4 cursor-pointer hover:bg-slate-800 transition-colors"
               onClick={() => setDownloadProgress(prev => ({ ...prev, isMinimized: false }))}>
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <span className="text-sm font-bold text-indigo-400">{Math.round(downloadProgress.progress)}%</span>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Maximize</span>
          </div>
        ) : (
          <div className="fixed top-4 right-4 z-50 w-80 bg-slate-900/95 border border-slate-800 p-4 rounded-xl shadow-2xl animate-[fadeIn_0.3s_ease-out]">
            <div className="flex justify-between items-start mb-2">
              <div className="truncate pr-2 flex-1">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {downloadProgress.status === 'decrypting' && 'Decrypting Secure Stream'}
                  {downloadProgress.status === 'success' && 'Decryption Complete'}
                  {downloadProgress.status === 'error' && 'Decryption Failed'}
                </div>
                <div className="text-sm font-semibold text-white truncate" title={downloadProgress.fileName}>
                  {downloadProgress.fileName}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {downloadProgress.status !== 'error' && (
                  <button 
                    onClick={() => setDownloadProgress(prev => ({ ...prev, isMinimized: true }))}
                    className="text-slate-400 hover:text-white p-1 rounded-full focus:outline-none hover:bg-slate-800 transition-colors"
                    title="Minimize"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                )}
                <button 
                  onClick={() => setDownloadProgress({ status: 'idle', progress: 0, fileName: '', isMinimized: false })}
                  className="text-slate-400 hover:text-white p-1 rounded-full focus:outline-none hover:bg-slate-800 transition-colors"
                  title="Close"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {downloadProgress.status === 'error' ? (
              <div className="text-xs font-mono text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20 mt-2 break-words max-h-32 overflow-y-auto">
                {downloadProgress.errorMessage}
              </div>
            ) : (
              <div className="flex items-center gap-3 mt-3">
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={`h-full transition-all duration-300 ${downloadProgress.status === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]'}`}
                    style={{ width: `${Math.min(downloadProgress.progress, 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-bold w-9 text-right ${downloadProgress.status === 'success' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                  {Math.round(downloadProgress.progress)}%
                </span>
              </div>
            )}
          </div>
        )
      )}

      </div>

      {/* Floating Tailwind Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-[slideInUp_0.3s_ease-out]">
          <div className={`p-4 rounded-xl shadow-xl border flex items-start gap-3 max-w-sm w-full ${
            toastMessage.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
            toastMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <div className="shrink-0 mt-0.5">
              {toastMessage.type === 'error' && (
                <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
              {toastMessage.type === 'success' && (
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              )}
              {toastMessage.type === 'info' && (
                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold">{toastMessage.title}</h4>
              <p className="text-xs opacity-90 mt-0.5">{toastMessage.message}</p>
            </div>
            <button 
              onClick={() => setToastMessage(null)}
              className="shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
