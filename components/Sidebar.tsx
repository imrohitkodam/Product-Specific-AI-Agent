
import React, { useRef, useState, useMemo } from 'react';
import { Document } from '../types';

interface SidebarProps {
  documents: Document[];
  onFileUpload: (files: FileList) => void;
  onRemoveDoc: (id: string) => void;
  onRemoveAll: () => void;
  onToggleDocSelection: (id: string) => void;
  isProcessing: boolean;
  onToggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  documents,
  onFileUpload,
  onRemoveDoc,
  onRemoveAll,
  onToggleDocSelection,
  isProcessing,
  onToggleSidebar
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const handleLogout = () => {
    localStorage.removeItem('is_admin_mode');
    window.location.reload();
  };

  // Group documents by moduleName
  const groupedDocuments = useMemo(() => {
    const groups: Record<string, Document[]> = {};
    documents.forEach(doc => {
      const key = doc.moduleName || 'Ungrouped';
      if (!groups[key]) groups[key] = [];
      groups[key].push(doc);
    });
    return groups;
  }, [documents]);

  const moduleNames = Object.keys(groupedDocuments);

  const toggleModule = (moduleName: string) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleName)) {
        newSet.delete(moduleName);
      } else {
        newSet.add(moduleName);
      }
      return newSet;
    });
  };

  const toggleAllInModule = (moduleName: string, selected: boolean) => {
    groupedDocuments[moduleName].forEach(doc => {
      if (doc.isSelected !== selected) {
        onToggleDocSelection(doc.id);
      }
    });
  };

  return (
    <div className="w-[340px] h-full flex flex-col border-r notebook-border bg-[#1e1f22]">
      <div className="p-4 flex items-center justify-between border-b notebook-border bg-black/10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
          <h2 className="text-xs font-bold text-gray-200 uppercase tracking-widest">Knowledge Base</h2>
        </div>
        <button onClick={onToggleSidebar} className="text-gray-500 hover:text-white p-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="bg-purple-600/5 border border-purple-500/20 rounded-xl p-4">
          <p className="text-[11px] text-purple-300/80 leading-relaxed mb-4">
            <strong>Admin View:</strong> Upload technical files, source code, or documentation.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            )}
            ADD NEW SOURCE
          </button>
          <input
            type="file" ref={fileInputRef}
            onChange={(e) => e.target.files && onFileUpload(e.target.files)}
            className="hidden" multiple accept="*"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Modules</h3>
            <div className="flex items-center gap-2">
              {documents.length > 0 && (
                <button
                  onClick={onRemoveAll}
                  className="text-[9px] text-red-400/60 hover:text-red-400 font-bold uppercase tracking-tighter transition-colors"
                >
                  Remove All
                </button>
              )}
              <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-400 tabular-nums">
                {moduleNames.length} modules • {documents.length} files
              </span>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 border border-dashed border-gray-800 rounded-xl bg-black/5">
              <svg className="w-8 h-8 text-gray-800 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
              <p className="text-[10px] text-gray-700">No knowledge indexed</p>
            </div>
          ) : (
            <div className="space-y-2">
              {moduleNames.map((moduleName) => {
                const moduleDocs = groupedDocuments[moduleName];
                const isExpanded = expandedModules.has(moduleName);
                const allSelected = moduleDocs.every(d => d.isSelected);
                const someSelected = moduleDocs.some(d => d.isSelected);

                return (
                  <div key={moduleName} className="border border-gray-800 rounded-lg overflow-hidden">
                    {/* Module Header */}
                    <div
                      className="flex items-center justify-between p-2 bg-black/20 cursor-pointer hover:bg-black/30 transition-colors"
                      onClick={() => toggleModule(moduleName)}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                          onChange={(e) => { e.stopPropagation(); toggleAllInModule(moduleName, !allSelected); }}
                          className="w-3.5 h-3.5 rounded border-gray-700 bg-transparent text-purple-600 focus:ring-purple-600 cursor-pointer"
                        />
                        <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                        <span className="text-[11px] text-gray-300 font-medium truncate">{moduleName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{moduleDocs.length} files</span>
                        <svg className={`w-3 h-3 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>

                    {/* Expanded File List (Limited to 20 max) */}
                    {isExpanded && (
                      <div className="max-h-48 overflow-y-auto bg-black/10">
                        {moduleDocs.slice(0, 20).map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between px-3 py-1.5 hover:bg-white/5 transition-colors text-[10px]">
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox" checked={doc.isSelected} onChange={() => onToggleDocSelection(doc.id)}
                                className="w-3 h-3 rounded border-gray-700 bg-transparent text-purple-600 focus:ring-purple-600 cursor-pointer"
                              />
                              <span className="text-gray-400 truncate">{doc.name}</span>
                            </div>
                            <button onClick={() => onRemoveDoc(doc.id)} className="text-gray-600 hover:text-red-400 p-0.5">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))}
                        {moduleDocs.length > 20 && (
                          <div className="px-3 py-2 text-[9px] text-gray-600 text-center border-t border-gray-800">
                            ... and {moduleDocs.length - 20} more files
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t notebook-border bg-black/20 space-y-3">
        <div className="space-y-2">
          {(() => {
            const total = documents.length;
            const indexed = documents.filter(d => d.indexingStatus === 'completed').length;
            const pending = documents.filter(d => d.indexingStatus === 'pending' || d.indexingStatus === 'indexing').length;
            const progress = total > 0 ? (indexed / total) * 100 : 0;

            if (total === 0 || pending === 0) return null;

            // ETA Calculation (rough estimate: 4 files per minute with free API)
            const filesPerMinute = 4; // Conservative estimate
            const etaMinutes = Math.ceil(pending / filesPerMinute);

            return (
              <div className="bg-black/40 rounded-lg p-3 border border-gray-800">
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>Indexing Progress</span>
                  <span>{indexed}/{total}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[9px] text-gray-600 mt-1">
                  <span>{pending} files remaining</span>
                  <span>~{etaMinutes} min</span>
                </div>
              </div>
            );
          })()}

          <button
            onClick={handleLogout}
            className="w-full text-center text-[10px] text-gray-500 hover:text-red-400 transition-colors uppercase tracking-widest font-bold pt-2"
          >
            Exit Admin Mode
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
