/**
 * 照片数据仓库
 * 统一管理照片元数据 + 图片 Blob 的 CRUD 操作
 * 使用单一 IndexedDB 连接，避免多连接竞争
 */

import { PhotoData } from '../../types';

const DB_NAME = 'chronos-db';
const DB_VERSION = 2;
const STORE_PHOTOS = 'photos-data'; // 照片元信息
const STORE_BLOBS = 'photo-blobs';  // 照片二进制数据

export class PhotoRepository {
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS);
        }
        if (!db.objectStoreNames.contains('photo-meta')) {
          const metaStore = db.createObjectStore('photo-meta', { keyPath: 'key' });
          metaStore.createIndex('lastModified', 'lastModified', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
          const photoStore = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
          photoStore.createIndex('timestamp', 'timestamp', { unique: false });
          photoStore.createIndex('year', 'year', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`[PhotoRepository] 无法打开数据库: ${request.error?.message}`));
      };
    });
  }

  private ensureDB(): IDBDatabase {
    if (!this.db) throw new Error('[PhotoRepository] 未初始化');
    return this.db;
  }

  // ========== 照片元数据 CRUD ==========

  async getAll(): Promise<PhotoData[]> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PHOTOS, 'readonly');
      const request = tx.objectStore(STORE_PHOTOS).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(`[PhotoRepository] 查询失败: ${request.error?.message}`));
    });
  }

  async getById(id: number): Promise<PhotoData | null> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PHOTOS, 'readonly');
      const request = tx.objectStore(STORE_PHOTOS).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(`[PhotoRepository] 查询失败: ${request.error?.message}`));
    });
  }

  async add(photos: PhotoData | PhotoData[]): Promise<void> {
    const db = this.ensureDB();
    const items = Array.isArray(photos) ? photos : [photos];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PHOTOS, 'readwrite');
      const store = tx.objectStore(STORE_PHOTOS);

      for (const photo of items) {
        const { file, ...serializablePhoto } = photo;
        store.put(serializablePhoto);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(`[PhotoRepository] 写入失败: ${tx.error?.message}`));
    });
  }

  async update(id: number, updates: Partial<PhotoData>): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      console.warn(`[PhotoRepository] 照片 ${id} 不存在，跳过更新`);
      return;
    }

    const updated = { ...existing, ...updates };
    delete (updated as any).file;

    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PHOTOS, 'readwrite');
      tx.objectStore(STORE_PHOTOS).put(updated);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(`[PhotoRepository] 更新失败: ${tx.error?.message}`));
    });
  }

  async remove(id: number): Promise<void> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PHOTOS, 'readwrite');
      tx.objectStore(STORE_PHOTOS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(`[PhotoRepository] 删除失败: ${tx.error?.message}`));
    });
  }

  async clear(): Promise<void> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PHOTOS, 'readwrite');
      tx.objectStore(STORE_PHOTOS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(`[PhotoRepository] 清空失败: ${tx.error?.message}`));
    });
  }

  // ========== 图片 Blob 存储（同一 DB 连接） ==========

  /** 保存图片 Blob */
  async saveBlob(key: string, blob: Blob | File): Promise<void> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readwrite');
      tx.objectStore(STORE_BLOBS).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(`[PhotoRepository] Blob 写入失败: ${tx.error?.message}`));
    });
  }

  /** 获取图片 Blob */
  async getBlob(key: string): Promise<Blob | null> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readonly');
      const request = tx.objectStore(STORE_BLOBS).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(`[PhotoRepository] Blob 读取失败: ${request.error?.message}`));
    });
  }

  /** 删除图片 Blob */
  async deleteBlob(key: string): Promise<void> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readwrite');
      tx.objectStore(STORE_BLOBS).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(`[PhotoRepository] Blob 删除失败: ${tx.error?.message}`));
    });
  }

  async dispose(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

