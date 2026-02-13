/**
 * useStorage Hook
 * 支持两种存储模式：
 *   - local: PhotoRepository (IndexedDB, 单一连接)
 *   - qiniu: StorageManager→QiniuProvider (云端) + PhotoRepository (元数据)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PhotoData } from '../types';
import { StorageManager, createStorageManager } from '../services/storage';
import { PhotoRepository } from '../services/data';
import { MOCK_PHOTOS } from '../constants';

interface UseStorageReturn {
  photos: PhotoData[];
  isLoading: boolean;
  error: string | null;
  storageType: string;
  addPhotos: (photos: PhotoData[]) => Promise<void>;
  deletePhoto: (id: number) => Promise<void>;
  updatePhoto: (id: number, updates: Partial<PhotoData>) => Promise<void>;
}

// 存储模式
const STORAGE_MODE = (typeof process !== 'undefined' && process.env?.STORAGE_PROVIDER) || 'local';
const isCloudMode = STORAGE_MODE === 'qiniu';

// 模块级单例 — 避免 StrictMode 双连接问题
let repoInstance: PhotoRepository | null = null;
let repoReady: Promise<void> | null = null;
let smInstance: StorageManager | null = null;

function getRepo(): { repo: PhotoRepository; ready: Promise<void> } {
  if (!repoInstance) {
    repoInstance = new PhotoRepository();
    repoReady = repoInstance.initialize();
  }
  return { repo: repoInstance, ready: repoReady! };
}

function getSM(): StorageManager {
  if (!smInstance) {
    smInstance = createStorageManager();
  }
  return smInstance;
}

export function useStorage(): UseStorageReturn {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { repo, ready } = getRepo();
        await ready;
        if (cancelled) return;

        const savedPhotos = await repo.getAll();
        if (cancelled) return;

        if (savedPhotos.length > 0) {
          if (isCloudMode) {
            // 云模式：照片 URL 就是 CDN 地址，直接使用
            if (!cancelled) setPhotos(savedPhotos);
          } else {
            // 本地模式：恢复 blob URL
            const photosWithUrls: PhotoData[] = [];
            for (const photo of savedPhotos) {
              let restoredUrl = photo.url;
              const isBlobUrl = photo.url?.startsWith('blob:');

              if (photo.storageKey) {
                try {
                  const blob = await repo.getBlob(photo.storageKey);
                  if (cancelled) return;
                  if (blob) {
                    restoredUrl = URL.createObjectURL(blob);
                    objectUrlsRef.current.push(restoredUrl);
                  } else if (isBlobUrl) {
                    restoredUrl = `https://picsum.photos/seed/${photo.id}/800/1000`;
                  }
                } catch {
                  if (isBlobUrl) {
                    restoredUrl = `https://picsum.photos/seed/${photo.id}/800/1000`;
                  }
                }
              } else if (isBlobUrl) {
                restoredUrl = `https://picsum.photos/seed/${photo.id}/800/1000`;
              }
              photosWithUrls.push({ ...photo, url: restoredUrl });
            }
            if (!cancelled) setPhotos(photosWithUrls);
          }
        }
        // 首次使用时不预填数据，等用户自己上传

        if (!cancelled) setIsLoading(false);
      } catch (err) {
        console.error('[useStorage] 初始化失败:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '存储初始化失败');
          setPhotos([]);
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, []);

  /** 添加照片 */
  const addPhotos = useCallback(async (newPhotos: PhotoData[]) => {
    setPhotos(prev => [...prev, ...newPhotos]);

    try {
      const { repo, ready } = getRepo();
      await ready;

      for (const photo of newPhotos) {
        if (photo.file) {
          try {
            if (isCloudMode) {
              // 云模式：上传到七牛云，用 CDN URL
              const sm = getSM();
              const meta = await sm.uploadFile(photo.file, {
                key: `photos/${photo.id}-${Date.now()}.jpg`,
              });
              const updatedPhoto = {
                ...photo,
                storageKey: meta.key,
                url: meta.url, // CDN URL
              };
              await repo.add(updatedPhoto);
              // 更新 UI 中的 URL（从 blob URL 切换到 CDN URL）
              setPhotos(prev =>
                prev.map(p => p.id === photo.id ? { ...p, url: meta.url, storageKey: meta.key } : p)
              );
            } else {
              // 本地模式：存到 IndexedDB
              const blobKey = `photo-${photo.id}`;
              await repo.saveBlob(blobKey, photo.file);
              await repo.add({ ...photo, storageKey: blobKey });
            }
          } catch (err) {
            console.error('[useStorage] 文件存储失败:', err);
            await repo.add(photo);
          }
        } else {
          await repo.add(photo);
        }
      }
    } catch (err) {
      console.error('[useStorage] 保存照片失败:', err);
    }
  }, []);

  /** 删除照片 */
  const deletePhoto = useCallback(async (id: number) => {
    setPhotos(prev => prev.filter(p => p.id !== id));

    try {
      const { repo, ready } = getRepo();
      await ready;

      const photo = await repo.getById(id);
      if (photo?.storageKey) {
        try {
          if (isCloudMode) {
            const sm = getSM();
            await sm.deleteFile(photo.storageKey);
          } else {
            await repo.deleteBlob(photo.storageKey);
          }
        } catch {
          console.warn('[useStorage] 删除存储文件失败，继续删除元数据');
        }
      }
      await repo.remove(id);
    } catch (err) {
      console.error('[useStorage] 删除照片失败:', err);
    }
  }, []);

  /** 更新照片 */
  const updatePhoto = useCallback(async (id: number, updates: Partial<PhotoData>) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

    try {
      const { repo, ready } = getRepo();
      await ready;
      await repo.update(id, updates);
    } catch (err) {
      console.error('[useStorage] 更新照片失败:', err);
    }
  }, []);

  return {
    photos,
    isLoading,
    error,
    storageType: STORAGE_MODE,
    addPhotos,
    deletePhoto,
    updatePhoto,
  };
}
