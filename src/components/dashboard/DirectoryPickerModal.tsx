import React, { useState, useEffect } from 'react';
import { vfsService } from '../../lib/services/vfs.service';
import { VFSNode } from '../../types';
import { X, Folder, ChevronRight, ChevronDown } from 'lucide-react';

interface DirectoryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetFolderId: string | null) => void;
  title: string;
}

export function DirectoryPickerModal({ isOpen, onClose, onConfirm, title }: DirectoryPickerModalProps) {
  const [folders, setFolders] = useState<VFSNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));

  // Close modal on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      loadFolders();
      setSelectedFolderId(null);
    }
  }, [isOpen]);

  const loadFolders = async () => {
    setLoading(true);
    try {
      const allFolders = await vfsService.getAllFolders();
      setFolders(allFolders);
    } catch (e) {
      console.error('Failed to load folders for picker', e);
    }
    setLoading(false);
  };

  const toggleFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedFolders(newExpanded);
  };

  const renderTree = (parentId: string | null = null, depth = 0) => {
    const children = folders.filter(f => f.parentId === parentId);
    if (children.length === 0) return null;

    return (
      <div className="flex flex-col">
        {children.map(folder => {
          const hasChildren = folders.some(f => f.parentId === folder.id);
          const isExpanded = expandedFolders.has(folder.id);
          const isSelected = selectedFolderId === folder.id;

          return (
            <div key={folder.id}>
              <div 
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-700'}`}
                style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
                onClick={() => setSelectedFolderId(folder.id)}
              >
                <div 
                  className={`w-4 h-4 flex items-center justify-center shrink-0 ${hasChildren ? 'cursor-pointer hover:bg-slate-200 rounded' : ''}`}
                  onClick={(e) => hasChildren ? toggleFolder(folder.id, e) : undefined}
                >
                  {hasChildren ? (
                    isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  ) : <span className="w-3.5 h-3.5" />}
                </div>
                <Folder className={`w-4 h-4 ${isSelected ? 'text-blue-500 fill-blue-500/20' : 'text-slate-400 fill-slate-400/20'}`} />
                <span className="text-sm font-medium truncate">{folder.name}</span>
              </div>
              {hasChildren && isExpanded && renderTree(folder.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900/90 border border-slate-800 text-slate-100 backdrop-blur-xl rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] animate-[scaleIn_0.2s_ease-out]">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-100">{title}</h3>
          <button onClick={onClose} aria-label="Close dialog" className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors focus:ring-2 focus:ring-slate-600 focus:outline-none">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="w-6 h-6 border-2 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="flex flex-col">
              <div 
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${selectedFolderId === 'root' || selectedFolderId === null ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'hover:bg-slate-800/60 text-slate-300'}`}
                onClick={() => setSelectedFolderId('root')}
              >
                <div className="w-4 h-4 shrink-0 flex items-center justify-center cursor-pointer hover:bg-slate-700 rounded" onClick={(e) => toggleFolder('root', e)}>
                  {expandedFolders.has('root') ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                </div>
                <Folder className={`w-4 h-4 ${selectedFolderId === 'root' || selectedFolderId === null ? 'text-indigo-400 fill-indigo-400/20' : 'text-slate-400 fill-slate-400/20'}`} />
                <span className="text-sm font-medium">My Drive</span>
              </div>
              {expandedFolders.has('root') && renderTree('root', 1)}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus:ring-2 focus:ring-slate-600 focus:outline-none text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm(selectedFolderId);
              onClose();
            }}
            className="px-4 py-2 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
          >
            {title.includes('Move') ? 'Move Here' : 'Copy Here'}
          </button>
        </div>
      </div>
    </div>
  );
}
