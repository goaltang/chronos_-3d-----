
import React, { useState, useMemo, useEffect } from 'react';
import { X, Trash2, Calendar, Type, Clock, Search, SortAsc, SortDesc, ShieldCheck, CheckSquare, Square, AlertTriangle, Loader2 } from 'lucide-react';
import { PhotoData } from '../types';
import { translations } from '../translations';
import { MONTH_NAMES } from '../constants';

interface ManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  photos: PhotoData[];
  onDelete: (id: number) => void;
  onUpdate: (id: number, updates: Partial<PhotoData>) => void;
  globalSearchQuery?: string; // 新增：从外部同步搜索
}

const ManagementPanel: React.FC<ManagementPanelProps> = ({ isOpen, onClose, photos, onDelete, onUpdate, globalSearchQuery = '' }) => {
  const t = translations.zh;
  const [internalSearch, setInternalSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // 同步全局搜索
  useEffect(() => {
    if (isOpen) setInternalSearch(globalSearchQuery);
  }, [globalSearchQuery, isOpen]);

  // 内部过滤与排序逻辑
  const displayList = useMemo(() => {
    let list = photos.filter(p => {
      const search = internalSearch.toLowerCase();
      return (
        p.title.toLowerCase().includes(search) ||
        p.year.includes(search) ||
        p.month.includes(search) ||
        p.description.toLowerCase().includes(search)
      );
    });

    return list.sort((a, b) => {
      return sortOrder === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
    });
  }, [photos, internalSearch, sortOrder]);

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBatchDelete = () => {
    if (window.confirm(`${t.deleteConfirm} (${selectedIds.size}个节点)`)) {
      selectedIds.forEach(id => onDelete(id));
      setSelectedIds(new Set());
      setIsBatchMode(false);
    }
  };

  // 转义正则特殊字符，防止用户输入 ( [ * 等导致 RegExp 崩溃
  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 高亮显示匹配文字的函数
  const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const escaped = escapeRegExp(highlight);
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <span key={i} className="text-cyan-400 bg-cyan-400/10 px-0.5 rounded-sm animate-pulse">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full w-full md:w-[450px] bg-black/40 backdrop-blur-3xl border-l border-white/10 z-50 transform transition-transform duration-700 cubic-bezier(0.4, 0, 0.2, 1) ${isOpen ? 'translate-x-0' : 'translate-x-full'} pointer-events-auto shadow-[20px_0_50px_rgba(0,0,0,0.5)] flex flex-col`}
    >
      {/* 头部：控制中心风格 */}
      <div className="p-8 border-b border-white/10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
        <div className="flex justify-between items-start relative z-10">
          <div>
            <h2 className="text-2xl font-bold tracking-[0.15em] text-white uppercase italic">{t.archiveManage}</h2>
            <p className="text-[10px] text-cyan-400 font-bold tracking-[0.3em] mt-1 opacity-70">{t.archiveSubtitle}</p>
          </div>
          <button onClick={onClose} className="group p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all">
            <X size={20} className="text-white/40 group-hover:text-white group-hover:rotate-90 transition-all duration-300" />
          </button>
        </div>

        {/* 快捷操作栏 */}
        <div className="mt-8 space-y-4">
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              {internalSearch ? <Loader2 size={14} className="text-cyan-400 animate-spin" /> : <Search size={14} className="text-white/20" />}
            </div>
            <input
              value={internalSearch}
              onChange={(e) => setInternalSearch(e.target.value)}
              placeholder={t.searchArchive}
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-10 py-3 text-xs text-white placeholder:text-white/20 focus:border-cyan-500/50 outline-none transition-all"
            />
            {internalSearch && (
              <button onClick={() => setInternalSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex justify-between items-center px-1">
            <button
              onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
              className="flex items-center space-x-2 text-[10px] text-white/40 hover:text-cyan-400 transition-colors uppercase tracking-widest"
            >
              {sortOrder === 'newest' ? <SortDesc size={14} /> : <SortAsc size={14} />}
              <span>{sortOrder === 'newest' ? t.newest : t.oldest}</span>
            </button>

            <button
              onClick={() => {
                setIsBatchMode(!isBatchMode);
                setSelectedIds(new Set());
              }}
              className={`flex items-center space-x-2 text-[10px] uppercase tracking-widest transition-all px-3 py-1.5 rounded-lg border ${isBatchMode ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400' : 'text-white/40 border-transparent hover:text-white'}`}
            >
              <CheckSquare size={14} />
              <span>{t.batchMode}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 列表主体 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {displayList.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-4 text-white/20 border border-dashed border-white/5 rounded-3xl bg-white/[0.02]">
            <AlertTriangle size={48} strokeWidth={1} />
            <div className="text-center">
              <p className="text-xs tracking-[0.2em]">{t.noResults}</p>
              {internalSearch && <button onClick={() => setInternalSearch('')} className="mt-4 text-[9px] text-cyan-400 underline decoration-cyan-400/30 underline-offset-4 uppercase tracking-[0.3em]">{t.clearSearch}</button>}
            </div>
          </div>
        ) : (
          displayList.map((photo, idx) => (
            <div
              key={photo.id}
              onClick={() => isBatchMode && toggleSelect(photo.id)}
              className={`group relative bg-white/[0.03] border rounded-2xl p-4 transition-all duration-500 hover:bg-white/[0.06] ${isBatchMode ? 'cursor-pointer' : ''
                } ${selectedIds.has(photo.id) ? 'border-cyan-500 shadow-[0_0_20px_rgba(0,255,255,0.1)]' : 'border-white/5 hover:border-white/20'
                }`}
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              {isBatchMode && (
                <div className="absolute top-4 right-4 z-10">
                  {selectedIds.has(photo.id) ?
                    <div className="bg-cyan-500 rounded-md p-0.5 shadow-[0_0_10px_#00ffff]"><CheckSquare size={16} color="black" /></div> :
                    <Square size={16} className="text-white/20" />
                  }
                </div>
              )}

              <div className="flex space-x-5">
                <div className="relative w-28 h-28 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 group-hover:border-cyan-500/50 transition-all">
                  <img src={photo.url} alt={photo.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-full h-[1px] bg-cyan-400/50 shadow-[0_0_10px_#00ffff] absolute top-0 animate-[scan_3s_linear_infinite]"></div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-between py-1">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_#00ffff] opacity-50"></div>
                      {!isBatchMode ? (
                        <input
                          className={`bg-transparent border-none text-sm text-white focus:ring-0 p-0 w-full font-bold tracking-wide transition-all focus:text-cyan-400`}
                          value={photo.title}
                          onChange={(e) => onUpdate(photo.id, { title: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="text-sm text-white/80 font-bold tracking-wide">
                          <HighlightText text={photo.title} highlight={internalSearch} />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="flex items-center space-x-2">
                        <Calendar size={12} className="text-white/20" />
                        <select
                          value={photo.month}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            const newMonth = e.target.value;
                            const monthIndex = MONTH_NAMES.indexOf(newMonth);
                            const ts = new Date(parseInt(photo.year), monthIndex >= 0 ? monthIndex : 0, 15).getTime();
                            onUpdate(photo.id, { month: newMonth, timestamp: ts });
                          }}
                          className="bg-transparent border border-white/10 text-white/60 text-xs rounded-lg px-2 py-1 focus:border-cyan-500/50 outline-none transition-all appearance-none cursor-pointer hover:border-white/30"
                        >
                          {MONTH_NAMES.map(m => <option key={m} value={m} className="bg-gray-900 text-white">{m}</option>)}
                        </select>
                        <span className="text-white/10">/</span>
                        <select
                          value={photo.year}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            const newYear = e.target.value;
                            const monthIndex = MONTH_NAMES.indexOf(photo.month);
                            const ts = new Date(parseInt(newYear), monthIndex >= 0 ? monthIndex : 0, 15).getTime();
                            onUpdate(photo.id, { year: newYear, timestamp: ts });
                          }}
                          className="bg-transparent border border-white/10 text-white/60 text-xs rounded-lg px-2 py-1 focus:border-cyan-500/50 outline-none transition-all appearance-none cursor-pointer hover:border-white/30"
                        >
                          {Array.from({ length: new Date().getFullYear() - 1969 }, (_, i) => (new Date().getFullYear() - i).toString()).map(y =>
                            <option key={y} value={y} className="bg-gray-900 text-white">{y}</option>
                          )}
                        </select>
                      </div>
                    </div>

                  </div>

                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/[0.03]">
                    <span className="text-[8px] text-white/10 uppercase tracking-[0.2em] font-mono">{t.id}: {photo.id.toString().slice(-6)}</span>
                    {!isBatchMode && (
                      deleteConfirmId === photo.id ? (
                        <div className="flex items-center space-x-2 animate-in fade-in duration-200">
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(photo.id); setDeleteConfirmId(null); }}
                            className="text-[8px] uppercase tracking-widest text-red-400 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-all font-bold"
                          >
                            确认
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                            className="text-[8px] uppercase tracking-widest text-white/30 px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-all"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(photo.id); }}
                          className="text-white/10 hover:text-red-500 p-1.5 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-8 border-t border-white/10 bg-white/[0.02] space-y-6">
        {isBatchMode && selectedIds.size > 0 ? (
          <button
            onClick={handleBatchDelete}
            className="w-full bg-red-500/20 hover:bg-red-500 border border-red-500/50 text-red-500 hover:text-white py-4 rounded-2xl text-[10px] uppercase tracking-[0.3em] font-bold transition-all animate-pulse"
          >
            抹除已选记忆节点 ({selectedIds.size})
          </button>
        ) : (
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[9px] text-white/20 uppercase tracking-[0.3em] mb-1">{t.temporalDensity}</span>
              <div className="flex items-baseline space-x-2">
                <span className={`text-2xl font-bold tracking-tighter transition-all ${internalSearch ? 'text-cyan-400' : 'text-white'}`}>{displayList.length}</span>
                <span className="text-[10px] text-cyan-500 font-bold uppercase">{t.fragments}</span>
              </div>
            </div>
            <div className={`w-12 h-12 rounded-full border border-white/10 flex items-center justify-center transition-all ${internalSearch ? 'text-cyan-400 opacity-100 shadow-[0_0_15px_rgba(0,255,255,0.2)]' : 'text-cyan-400 opacity-30'}`}>
              <ShieldCheck size={24} strokeWidth={1} />
            </div>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 255, 255, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 255, 255, 0.2); }
        
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
};

export default ManagementPanel;
