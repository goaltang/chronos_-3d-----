
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Plus, Settings, ArrowLeft, Search, Filter, X, Zap, Volume2, Loader2, Music, Play, Pause, Download, Trash2, RefreshCw, AlertTriangle, Upload, Clock } from 'lucide-react';
import { PhotoData } from '../types';
import { translations } from '../translations';
import ManagementPanel from './ManagementPanel';
import { MONTH_NAMES } from '../constants';

// 待上传文件（带预览和时间选择）
interface PendingFile {
  file: File;
  previewUrl: string;
  year: string;
  month: string;
}

interface OverlayProps {
  onUpload: (photos: PhotoData[]) => void;
  photoCount: number;
  photos: PhotoData[];
  filteredPhotos: PhotoData[];
  onDelete: (id: number) => void;
  onUpdate: (id: number, updates: Partial<PhotoData>) => void;
  focusedPhoto: PhotoData | null;
  onCloseDetail: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedYear: string;
  onYearChange: (year: string) => void;
  onSpeak: (text: string) => void;
  isPlayingAudio?: boolean;
  ttsFailed?: boolean;
  onAnalyze: (photo: PhotoData) => void;
  onDeleteFromDetail: () => void;
  isAutoPlaying?: boolean;
  onAutoPlayToggle: () => void;
  autoPlaySpeed?: number;
  onAutoPlaySpeedChange?: (speed: number) => void;
}

const Overlay: React.FC<OverlayProps> = ({
  onUpload, photoCount, photos, filteredPhotos,
  onDelete, onUpdate, focusedPhoto, onCloseDetail,
  searchQuery, onSearchChange, selectedYear, onYearChange,
  onSpeak, isPlayingAudio = false, ttsFailed = false,
  onAnalyze, onDeleteFromDetail,
  isAutoPlaying = false, onAutoPlayToggle, autoPlaySpeed = 0.3, onAutoPlaySpeedChange
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations.zh;

  // 生成年份范围
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];
    for (let y = currentYear; y >= 1970; y--) {
      years.push(y.toString());
    }
    return years;
  }, []);

  const displayPhotos = useMemo(() => {
    return [...filteredPhotos].sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredPhotos]);

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(photos.map(p => p.year)));
    return years.sort((a: string, b: string) => parseInt(b) - parseInt(a));
  }, [photos]);

  const hotTags = useMemo(() => {
    const tags = Array.from(new Set(photos.slice(0, 20).map(p => p.year)));
    return tags.slice(0, 3);
  }, [photos]);

  const getScrollContainer = () => {
    const divs = document.querySelectorAll('div');
    return Array.from(divs).find(el => {
      const style = window.getComputedStyle(el);
      return (style.overflow === 'auto' || style.overflowY === 'auto' || style.overflow === 'scroll') &&
        el.scrollHeight > el.clientHeight;
    }) as HTMLElement | null;
  };

  useEffect(() => {
    const el = getScrollContainer();
    if (!el) return;

    const handleSync = () => {
      const progress = el.scrollTop / (el.scrollHeight - el.clientHeight);
      setScrollProgress(isNaN(progress) ? 0 : progress);
    };

    // 初始化同步一次，避免第一次渲染进度为 0
    handleSync();
    el.addEventListener('scroll', handleSync, { passive: true });

    return () => {
      el.removeEventListener('scroll', handleSync);
    };
  }, [filteredPhotos.length]);

  const currentEra = useMemo(() => {
    if (displayPhotos.length === 0) return { month: "---", year: "---" };
    const rawIndex = Math.round(scrollProgress * (displayPhotos.length - 1));
    const index = Math.max(0, Math.min(rawIndex, displayPhotos.length - 1));
    const p = displayPhotos[index];
    return { month: p?.month || "---", year: p?.year || "---" };
  }, [scrollProgress, displayPhotos]);

  const handleJumpTo = (progress: number) => {
    const el = getScrollContainer();
    if (el) {
      el.scrollTo({
        top: progress * (el.scrollHeight - el.clientHeight),
        behavior: 'smooth'
      });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const rawFiles = Array.from(files);
    const now = new Date();
    const pending: PendingFile[] = rawFiles.map(f => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
      year: now.getFullYear().toString(),
      month: MONTH_NAMES[now.getMonth()],
    }));
    setPendingFiles(pending);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 更新待上传文件的时间
  const updatePendingFile = (index: number, updates: Partial<Pick<PendingFile, 'year' | 'month'>>) => {
    setPendingFiles(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  // 确认上传
  const handleConfirmUpload = () => {
    const baseId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const newPhotos: PhotoData[] = pendingFiles.map((pf, index) => {
      const monthIndex = MONTH_NAMES.indexOf(pf.month);
      const ts = new Date(parseInt(pf.year), monthIndex >= 0 ? monthIndex : 0, 15).getTime();
      return {
        id: baseId + index,
        url: pf.previewUrl,
        title: "解析中...",
        year: pf.year,
        month: pf.month,
        timestamp: ts,
        description: "正在连接时空矩阵进行特征识别...",
        isAnalyzing: true,
        file: pf.file,
      };
    });
    onUpload(newPhotos);
    setPendingFiles([]);
  };

  // 取消上传
  const handleCancelUpload = () => {
    pendingFiles.forEach(pf => URL.revokeObjectURL(pf.previewUrl));
    setPendingFiles([]);
  };

  return (
    <>
      {/* 顶部 & 侧边 UI */}
      <div className={`fixed inset-0 pointer-events-none z-20 flex flex-col justify-between p-8 md:p-12 select-none transition-all duration-1000 ${focusedPhoto ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100'}`}>
        <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleFileChange} />

        <header className="flex flex-col md:flex-row justify-between items-start space-y-6 md:space-y-0">
          <div className="pointer-events-auto group">
            <h1 className="text-4xl md:text-7xl font-bold tracking-tighter text-white opacity-90 leading-none group-hover:text-cyan-400 transition-colors duration-500 uppercase">
              {t.title}
            </h1>
            <div className="flex items-center space-x-3 mt-4">
              <div className="h-px w-8 bg-cyan-500/50"></div>
              <p className="text-cyan-400 font-light tracking-[0.3em] text-[10px] uppercase">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex flex-col md:items-end space-y-4 pointer-events-auto">
            <div className="flex space-x-3">
              {/* 搜索框 */}
              <div className="flex flex-col items-end space-y-2">
                <div className="relative group/search flex items-center">
                  <div className={`absolute left-4 transition-all duration-500 ${isSearching ? 'text-cyan-400 scale-110' : 'text-white/20'}`}>
                    {isSearching ? <Zap size={14} className="animate-pulse" /> : <Search size={14} />}
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className="bg-white/5 border border-white/10 focus:border-cyan-500/50 rounded-2xl pl-10 pr-12 py-3 text-xs text-white placeholder:text-white/20 w-48 md:w-64 focus:w-80 transition-all outline-none backdrop-blur-md"
                  />
                  {searchQuery && (
                    <button onClick={() => onSearchChange('')} className="absolute right-3 p-1 hover:bg-white/10 rounded-full text-white/40">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* 自动播放按钮 */}
              {!focusedPhoto && (
                <button
                  onClick={onAutoPlayToggle}
                  className={`group flex items-center justify-center border w-12 h-12 rounded-2xl transition-all duration-300 backdrop-blur-md ${isAutoPlaying
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.3)]'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/60 hover:text-white'
                    }`}
                >
                  {isAutoPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
              )}

              {/* 上传按钮 */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="group flex items-center space-x-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 px-6 py-3 rounded-2xl transition-all duration-300 backdrop-blur-md"
              >
                <Plus size={16} className="text-cyan-400" />
                <span className="text-[10px] uppercase tracking-[0.25em] text-cyan-400 font-bold">{t.upload}</span>
              </button>

              <button onClick={() => setIsPanelOpen(true)} className="group flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 w-12 h-12 rounded-2xl transition-all duration-300">
                <Settings size={18} className="text-white/60 group-hover:text-white" />
              </button>
            </div>
          </div>
        </header>

        {/* 进度条 (保持原样) */}
        <div className="fixed left-8 md:left-12 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center space-y-8 pointer-events-auto">
          <div className="vertical-rl text-[9px] tracking-[0.6em] text-white/20 uppercase mb-2 font-bold">{t.path}</div>
          <div
            className="h-64 w-[4px] bg-white/5 relative rounded-full cursor-pointer group/track"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const y = e.clientY - rect.top;
              handleJumpTo(y / rect.height);
            }}
          >
            <div className="absolute top-0 left-0 w-full bg-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.6)] rounded-full" style={{ height: `${scrollProgress * 100}%` }} />
            <div className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_15px_#fff] border-2 border-cyan-500 z-10" style={{ top: `${scrollProgress * 100}%`, marginTop: '-8px' }} />
          </div>
          <div className="flex flex-col items-center text-center space-y-1">
            <span className="text-cyan-400 font-bold text-lg tracking-widest uppercase">{currentEra.month}</span>
            <span className="text-white font-light text-sm tracking-tighter">{currentEra.year}</span>
          </div>
        </div>

        <footer className="flex justify-between items-end">
          <div className="flex flex-col space-y-2">
            <div className="flex space-x-10 text-[9px] text-white/40 uppercase tracking-[0.4em]">
              <div className="flex flex-col space-y-1">
                <span className="text-white/20">{t.fragments}</span>
                <span className="text-white/80 font-bold">{photoCount} 节点</span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* 详情卡片 - 增强 AI 交互 */}
      {focusedPhoto && (
        <div className="fixed inset-0 z-40 flex items-center justify-end p-8 md:p-16 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/20 to-black/80 pointer-events-none"></div>

          <button onClick={() => { onCloseDetail(); setShowDeleteConfirm(false); }} className="absolute top-12 left-12 pointer-events-auto flex items-center space-x-4 text-white/40 hover:text-cyan-400 transition-all group">
            <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:border-cyan-400/50 group-hover:bg-cyan-400/10 transition-all">
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </div>
            <span className="text-[10px] uppercase tracking-[0.4em]">{t.back}</span>
          </button>

          <div className="w-full max-w-lg bg-black/40 backdrop-blur-3xl border border-white/10 p-10 md:p-14 rounded-[2.5rem] pointer-events-auto animate-in fade-in slide-in-from-right-16 duration-700 shadow-2xl relative">
            {/* 装饰线条 */}
            <div className="absolute top-0 right-10 w-px h-full bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent"></div>

            <div className="relative space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${focusedPhoto.isAnalyzing ? 'bg-yellow-400 animate-pulse shadow-[0_0_10px_#facc15]' : focusedPhoto.title === '解析失败' ? 'bg-red-400 shadow-[0_0_10px_#f87171]' : 'bg-cyan-400 shadow-[0_0_10px_#00ffff]'}`}></div>
                    <span className="text-cyan-400 text-[10px] font-bold tracking-[0.5em] uppercase">{t.metadata}</span>
                  </div>

                  {/* AI 朗读按钮 + TTS 失败提示 */}
                  <div className="flex items-center space-x-2">
                    {ttsFailed && (
                      <div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/30 animate-in fade-in duration-300">
                        <AlertTriangle size={10} className="text-red-400" />
                        <span className="text-[8px] text-red-400 font-bold">{t.ttsFailed}</span>
                      </div>
                    )}
                    <button
                      onClick={() => onSpeak(focusedPhoto.description)}
                      disabled={focusedPhoto.isAnalyzing}
                      className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border transition-all ${isPlayingAudio ? 'bg-cyan-500 border-cyan-500 text-black shadow-[0_0_15px_rgba(0,255,255,0.5)]' : focusedPhoto.isAnalyzing ? 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed' : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/30'}`}
                    >
                      {isPlayingAudio ? <Music size={12} className="animate-bounce" /> : <Volume2 size={12} />}
                      <span className="text-[8px] font-bold uppercase tracking-widest">{isPlayingAudio ? '正在朗读...' : t.speakTooltip}</span>
                    </button>
                  </div>
                </div>

                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white leading-[1.1]">
                  {focusedPhoto.isAnalyzing ? (
                    <span className="flex items-center space-x-3">
                      <Loader2 size={28} className="animate-spin text-cyan-400" />
                      <span className="animate-pulse italic opacity-50">分析中...</span>
                    </span>
                  ) : focusedPhoto.title === '解析失败' ? (
                    <span className="text-red-400/80">{focusedPhoto.title}</span>
                  ) : focusedPhoto.title}
                </h2>

                <div className="flex items-center space-x-8 pt-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-white/30 uppercase tracking-widest">{t.ref}</span>
                    <span className="text-xl text-white/80 font-light italic">{focusedPhoto.month} / {focusedPhoto.year}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-white/30 uppercase tracking-widest">{t.timestamp}</span>
                    <span className="text-sm text-white/50 font-light">{new Date(focusedPhoto.timestamp).toLocaleString('zh-CN')}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="h-px w-full bg-gradient-to-r from-white/20 to-transparent"></div>
                <div className="relative min-h-[100px]">
                  {focusedPhoto.isAnalyzing ? (
                    <div className="space-y-3">
                      <div className="h-4 bg-white/5 rounded-full animate-pulse w-3/4"></div>
                      <div className="h-4 bg-white/5 rounded-full animate-pulse w-1/2"></div>
                      <div className="h-4 bg-white/5 rounded-full animate-pulse w-2/3"></div>
                      <p className="text-white/30 text-sm italic mt-4">正在连接时空矩阵进行特征识别...</p>
                    </div>
                  ) : (
                    <p className="text-white/60 leading-relaxed text-lg font-light tracking-wide italic">
                      "{focusedPhoto.description}"
                    </p>
                  )}
                  {isPlayingAudio && (
                    <div className="absolute -bottom-4 left-0 w-full h-1 flex items-end space-x-0.5">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-cyan-400/30 animate-[wave_1s_ease-in-out_infinite]"
                          style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.05}s` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 操作按钮组 */}
              <div className="pt-6 space-y-4">
                {/* 重新分析按钮 - 仅在有 file 且非分析中时显示 */}
                {focusedPhoto.file && !focusedPhoto.isAnalyzing && (
                  <button
                    onClick={() => onAnalyze(focusedPhoto)}
                    className="flex items-center space-x-3 w-full px-5 py-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/15 hover:border-cyan-500/40 transition-all group"
                  >
                    <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                    <span className="text-[10px] uppercase tracking-widest font-bold">
                      {focusedPhoto.title === '解析失败' ? t.retryAnalysis : t.reAnalyze}
                    </span>
                  </button>
                )}

                <div className="flex items-center space-x-3">
                  {/* 下载按钮 */}
                  <a
                    href={focusedPhoto.url}
                    download={`chronos_${focusedPhoto.id}.jpg`}
                    className="flex-1 flex items-center justify-center space-x-2 px-5 py-3 rounded-xl border border-white/10 text-white/50 hover:bg-white/5 hover:text-white transition-all"
                  >
                    <Download size={14} />
                    <span className="text-[10px] uppercase tracking-widest">{t.download}</span>
                  </a>

                  {/* 管理面板按钮 */}
                  <button
                    onClick={() => setIsPanelOpen(true)}
                    className="flex-1 flex items-center justify-center space-x-2 px-5 py-3 rounded-xl border border-white/10 text-white/50 hover:bg-white/5 hover:text-white transition-all"
                  >
                    <Settings size={14} />
                    <span className="text-[10px] uppercase tracking-widest">{t.edit}</span>
                  </button>

                  {/* 删除按钮 */}
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center justify-center px-4 py-3 rounded-xl border border-red-500/10 text-red-400/50 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* 删除确认对话框 */}
                {showDeleteConfirm && (
                  <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle size={14} className="text-red-400" />
                      <span className="text-red-400 text-xs font-bold">{t.deleteConfirmDetail}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => { onDeleteFromDetail(); setShowDeleteConfirm(false); }}
                        className="flex-1 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] uppercase tracking-widest font-bold hover:bg-red-500/30 transition-all"
                      >
                        确认抹除
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-2 rounded-lg border border-white/10 text-white/40 text-[10px] uppercase tracking-widest hover:bg-white/5 transition-all"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 上传预览浮层 */}
      {pendingFiles.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] max-h-[70vh] bg-black/60 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_0_40px_rgba(0,255,255,0.1)] overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500 pointer-events-auto">
          {/* 头部 */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00ffff] animate-pulse"></div>
              <span className="text-cyan-400 text-[10px] font-bold tracking-[0.4em] uppercase">时间锚点校准</span>
            </div>
            <button onClick={handleCancelUpload} className="p-1.5 hover:bg-white/10 rounded-full text-white/30 hover:text-white transition-all">
              <X size={16} />
            </button>
          </div>

          {/* 文件列表 */}
          <div className="max-h-[45vh] overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {pendingFiles.map((pf, idx) => (
              <div key={idx} className="flex items-center space-x-4 bg-white/[0.03] border border-white/5 rounded-2xl p-3 hover:border-white/15 transition-all">
                {/* 缩略图 */}
                <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                  <img src={pf.previewUrl} alt="" className="w-full h-full object-cover" />
                </div>

                {/* 时间选择器 */}
                <div className="flex-1 flex items-center space-x-2">
                  <Clock size={12} className="text-white/20 flex-shrink-0" />
                  <select
                    value={pf.year}
                    onChange={(e) => updatePendingFile(idx, { year: e.target.value })}
                    className="bg-white/5 border border-white/10 text-white text-xs rounded-xl px-3 py-2 focus:border-cyan-500/50 outline-none transition-all appearance-none cursor-pointer flex-1"
                  >
                    {yearOptions.map(y => <option key={y} value={y} className="bg-gray-900 text-white">{y}</option>)}
                  </select>
                  <select
                    value={pf.month}
                    onChange={(e) => updatePendingFile(idx, { month: e.target.value })}
                    className="bg-white/5 border border-white/10 text-white text-xs rounded-xl px-3 py-2 focus:border-cyan-500/50 outline-none transition-all appearance-none cursor-pointer flex-1"
                  >
                    {MONTH_NAMES.map(m => <option key={m} value={m} className="bg-gray-900 text-white">{m}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* 底部操作栏 */}
          <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10px] text-white/30 tracking-widest uppercase">{pendingFiles.length} 个碎片待注入</span>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleCancelUpload}
                className="px-4 py-2 rounded-xl border border-white/10 text-white/40 text-[10px] uppercase tracking-widest hover:bg-white/5 transition-all"
              >
                取消
              </button>
              <button
                onClick={handleConfirmUpload}
                className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 text-[10px] uppercase tracking-widest font-bold hover:bg-cyan-500/25 transition-all shadow-[0_0_15px_rgba(0,255,255,0.15)]"
              >
                <Upload size={12} />
                <span>确认上传</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ManagementPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        photos={photos}
        onDelete={onDelete}
        onUpdate={onUpdate}
        globalSearchQuery={searchQuery}
      />

      <style>{`
        @keyframes wave {
          0%, 100% { height: 20%; }
          50% { height: 100%; }
        }
      `}</style>
    </>
  );
};

export default Overlay;
