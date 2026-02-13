
export interface PhotoData {
  id: number;
  url: string;
  title: string;
  year: string;
  month: string;
  timestamp: number;
  description: string;
  isAnalyzing?: boolean;
  file?: File; // 用于上传后的 AI 处理
  storageKey?: string; // 存储层文件标识（IndexedDB key / 云端 object key）
}

export interface ExperienceProps {
  photos: PhotoData[];
  focusedPhotoId: number | null;
  onFocusPhoto: (id: number | null) => void;
}

/** 存储配置 */
export interface StorageConfig {
  provider: 'local' | 'qiniu';
  bucket?: string;
  region?: string;
  domain?: string;
}

/** 同步状态 */
export type SyncStatusType = 'idle' | 'syncing' | 'success' | 'error';

