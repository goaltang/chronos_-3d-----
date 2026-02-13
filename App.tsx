
import React, { Suspense, useState, useCallback, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import Experience from './components/Experience';
import Overlay from './components/Overlay';
import { MONTH_NAMES } from './constants';
import { PhotoData } from './types';
import { GoogleGenAI, Modality } from "@google/genai";
import { useStorage } from './hooks/useStorage';

// 辅助函数：文件转 Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

// 辅助函数：解码音频数据
const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

const App: React.FC = () => {
  // ✅ 使用 useStorage hook 替代内存状态，数据自动持久化到 IndexedDB
  const { photos, isLoading, addPhotos, deletePhoto, updatePhoto } = useStorage();

  const [focusedPhotoId, setFocusedPhotoId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // AI 状态
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [ttsFailed, setTtsFailed] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // 自动播放状态
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(0.3);

  const filteredPhotos = useMemo(() => {
    return photos.filter(p => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.year.includes(searchQuery) ||
        p.month.includes(searchQuery);
      const matchesYear = selectedYear === 'all' || p.year === selectedYear;
      return matchesSearch && matchesYear;
    });
  }, [photos, searchQuery, selectedYear]);

  // AI 解析逻辑：使用 Gemini 分析图片
  const analyzePhoto = async (photo: PhotoData) => {
    if (!photo.file) return;

    // 检查 API Key 是否配置
    if (!process.env.API_KEY) {
      console.warn('Gemini API Key 未配置，跳过 AI 解析');
      updatePhoto(photo.id, {
        title: photo.file.name.replace(/\.[^/.]+$/, '') || '未命名记忆',
        description: 'AI 解析未启用（请配置 GEMINI_API_KEY）',
        isAnalyzing: false,
      });
      return;
    }
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Data = await fileToBase64(photo.file);

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: photo.file.type } },
            { text: "作为 Chronos 时空档案管理员，请分析这张图片。生成一个富有诗意的、赛博朋克或科幻风格的标题（10字以内）和一段深情的描述（50字以内）。同时根据图片内容（季节、光线、场景线索等）推测可能的拍摄年份和月份。请以 JSON 格式返回：{\"title\": \"...\", \"description\": \"...\", \"year\": \"2024\", \"month\": \"6月\"}" }
          ]
        },
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || '{}');
      // 如果 AI 返回了时间信息，更新 year/month/timestamp
      const updates: Partial<PhotoData> = {
        title: result.title || "未知记忆节点",
        description: result.description || "时空扰动严重，数据无法完全复原。",
        isAnalyzing: false
      };
      if (result.year) {
        updates.year = result.year;
        // 尝试从 AI 返回的 month 解析月份索引
        const monthIndex = MONTH_NAMES.findIndex(m => result.month?.includes(m.replace('月', '')));
        if (monthIndex >= 0) {
          updates.month = MONTH_NAMES[monthIndex];
          updates.timestamp = new Date(parseInt(result.year), monthIndex, 15).getTime();
        } else {
          updates.timestamp = new Date(parseInt(result.year), 0, 1).getTime();
        }
      }
      updatePhoto(photo.id, updates);
    } catch (error) {
      console.error("AI Analysis failed:", error);
      updatePhoto(photo.id, {
        title: "解析失败",
        description: "时空矩阵连接超时。该节点可能属于加密层级。",
        isAnalyzing: false
      });
    }
  };

  // 使用 ref 存储最新的 analyzePhoto，避免 useCallback 闭包过期
  const analyzePhotoRef = React.useRef(analyzePhoto);
  analyzePhotoRef.current = analyzePhoto;

  const handleUpload = useCallback((newPhotos: PhotoData[]) => {
    // ✅ addPhotos 会同时更新 UI 和写入 IndexedDB
    addPhotos(newPhotos);
    // 触发 AI 解析（通过 ref 获取最新的 analyzePhoto）
    newPhotos.forEach(p => {
      if (p.isAnalyzing) analyzePhotoRef.current(p);
    });
  }, [addPhotos]);

  const handleDelete = useCallback((id: number) => {
    deletePhoto(id);
    if (focusedPhotoId === id) setFocusedPhotoId(null);
  }, [focusedPhotoId, deletePhoto]);

  const handleUpdate = useCallback((id: number, updates: Partial<PhotoData>) => {
    updatePhoto(id, updates);
  }, [updatePhoto]);

  const handleFocusPhoto = useCallback((id: number | null) => {
    setFocusedPhotoId(id);
  }, []);

  // 重新分析单张照片
  const handleReAnalyze = useCallback((photo: PhotoData) => {
    updatePhoto(photo.id, { isAnalyzing: true, title: '解析中...', description: '正在连接时空矩阵进行特征识别...' });
    analyzePhotoRef.current(photo);
  }, [updatePhoto]);

  // 从详情页删除
  const handleDeleteFromDetail = useCallback(() => {
    if (focusedPhotoId !== null) {
      deletePhoto(focusedPhotoId);
      setFocusedPhotoId(null);
    }
  }, [focusedPhotoId, deletePhoto]);

  // AI TTS 逻辑
  const handleSpeak = async (text: string) => {
    if (isPlayingAudio) return;

    setIsPlayingAudio(true);
    setTtsFailed(false);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `用温柔、有科技感的口吻朗读：${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

        const audioBuffer = await decodeAudioData(bytes, ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsPlayingAudio(false);
        source.start();
      } else {
        setIsPlayingAudio(false);
      }
    } catch (error) {
      console.error("TTS failed:", error);
      setIsPlayingAudio(false);
      setTtsFailed(true);
      // 3秒后自动清除失败提示
      setTimeout(() => setTtsFailed(false), 3000);
    }
  };

  const focusedPhoto = photos.find(p => p.id === focusedPhotoId) || null;

  // 加载状态显示
  if (isLoading) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-cyan-400 text-xs tracking-[0.3em] uppercase animate-pulse">
            正在从时空矩阵恢复数据...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
        className="touch-none"
      >
        <Suspense fallback={null}>
          <Experience
            photos={filteredPhotos}
            focusedPhotoId={focusedPhotoId}
            onFocusPhoto={handleFocusPhoto}
            isAutoPlaying={isAutoPlaying}
            autoPlaySpeed={autoPlaySpeed}
          />
        </Suspense>
      </Canvas>

      <Overlay
        onUpload={handleUpload}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        photoCount={filteredPhotos.length}
        photos={photos}
        filteredPhotos={filteredPhotos}
        focusedPhoto={focusedPhoto}
        onCloseDetail={() => handleFocusPhoto(null)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        onSpeak={handleSpeak}
        isPlayingAudio={isPlayingAudio}
        ttsFailed={ttsFailed}
        onAnalyze={handleReAnalyze}
        onDeleteFromDetail={handleDeleteFromDetail}
        isAutoPlaying={isAutoPlaying}
        onAutoPlayToggle={() => setIsAutoPlaying(!isAutoPlaying)}
        autoPlaySpeed={autoPlaySpeed}
        onAutoPlaySpeedChange={setAutoPlaySpeed}
      />

      <Loader
        containerStyles={{ background: '#000' }}
        innerStyles={{ background: '#333' }}
        barStyles={{ background: '#00ffff' }}
        dataInterpolation={(p) => `时空矩阵同步中: ${p.toFixed(0)}%`}
      />
    </div>
  );
};

export default App;

