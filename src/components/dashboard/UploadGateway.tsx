import * as React from 'react';
import { useCallback, useRef, useState, useEffect } from 'react';

interface UploadGatewayProps {
  onUpload: (files: File[]) => void;
  disabled?: boolean;
  requiresAuth?: boolean;
}

export function UploadGateway({ onUpload, disabled = false, requiresAuth = false }: UploadGatewayProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      if (e.dataTransfer?.types.includes('Files')) {
        dragCounter.current++;
        setIsDragging(true);
      }
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      if (disabled) return;
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        onUpload(Array.from(e.dataTransfer.files));
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onUpload, disabled]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <div className="flex items-center justify-between bg-white border border-slate-200 shadow-sm rounded-full px-4 py-2 w-full max-w-3xl mb-1">
        <div className="flex items-center gap-3">
          <button 
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-5 py-2 rounded-full transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Upload
          </button>
          
          <div className="h-6 w-px bg-slate-200 mx-2"></div>
          
          {requiresAuth ? (
             <span className="text-sm font-medium text-slate-400 flex items-center gap-2">
               <span className="text-rose-500"></span> Read-only mode. Login to upload.
             </span>
          ) : (
             <span className="text-sm text-slate-400">Drop files anywhere to upload</span>
          )}
        </div>
        
        <input 
          type="file" 
          multiple 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange}
        />
      </div>

      {isDragging && !disabled && (
        <div className="fixed inset-0 z-50 bg-indigo-600/20 border-4 border-dashed border-indigo-500 backdrop-blur-md flex items-center justify-center pointer-events-none transition-all duration-200">
           <div className="bg-slate-900/90 border border-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center backdrop-blur-xl text-slate-100">
             <div className="w-20 h-20 bg-indigo-500/15 text-indigo-400 rounded-full flex items-center justify-center mb-4 ring-1 ring-indigo-500/30">
               <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
               </svg>
             </div>
             <h2 className="text-2xl font-bold text-slate-100">Drop files to upload</h2>
             <p className="text-slate-400 mt-2">Release to securely store in Lukman Cloud</p>
           </div>
        </div>
      )}
    </>
  );
}
