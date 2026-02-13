/**
 * IndexedDB 本地存储实现
 * 默认的持久化方案，无需任何云端配置即可使用
 */

import {
  IStorageProvider,
  StoredFileMeta,
  UploadOptions,
} from './StorageProvider';

const DB_NAME = 'chronos-db';
const DB_VERSION = 2;  // ✅ 与 PhotoRepository 保持一致，避免版本冲突
const STORE_BLOBS = 'photo-blobs';   // 存储图片二进制数据
const STORE_META = 'photo-meta';     // 存储文件元信息
const STORE_PHOTOS = 'photos-data';  // 照片业务数据（与 PhotoRepository 共享）

export class LocalStorageProvider implements IStorageProvider {
  readonly type = 'local' as const;
  private db: IDBDatabase | null = null;

  /** 打开/创建 IndexedDB 数据库 */
  async initialize(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS); // key 为文件唯一标识
        }

        if (!db.objectStoreNames.contains(STORE_META)) {
          const metaStore = db.createObjectStore(STORE_META, { keyPath: 'key' });
          metaStore.createIndex('lastModified', 'lastModified', { unique: false });
        }

        // ✅ 同时创建 photos-data store，与 PhotoRepository 保持一致的 schema
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
        reject(new Error(`[LocalStorage] 无法打开 IndexedDB: ${request.error?.message}`));
      };
    });
  }

  /** 确保数据库已初始化 */
  private ensureDB(): IDBDatabase {
    if (!this.db) {
      throw new Error('[LocalStorage] 数据库未初始化，请先调用 initialize()');
    }
    return this.db;
  }

  /** 生成存储 key */
  private generateKey(file: File | Blob, customKey?: string): string {
    if (customKey) return customKey;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = file instanceof File ? file.name.split('.').pop() || 'jpg' : 'jpg';
    return `photos/${timestamp}-${random}.${ext}`;
  }

  async uploadFile(file: File | Blob, options?: UploadOptions): Promise<StoredFileMeta> {
    const db = this.ensureDB();
    const key = this.generateKey(file, options?.key);
    const mimeType = options?.mimeType || (file instanceof File ? file.type : 'image/jpeg');

    const meta: StoredFileMeta = {
      key,
      url: '', // 本地存储使用 ObjectURL，在 getFileUrl 中生成
      size: file.size,
      mimeType,
      lastModified: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_BLOBS, STORE_META], 'readwrite');

      tx.objectStore(STORE_BLOBS).put(file, key);
      tx.objectStore(STORE_META).put(meta);

      // 模拟进度回调（本地存储几乎瞬间完成）
      options?.onProgress?.(50);

      tx.oncomplete = () => {
        options?.onProgress?.(100);
        // 为元信息生成临时 URL
        meta.url = URL.createObjectURL(file);
        resolve(meta);
      };

      tx.onerror = () => {
        reject(new Error(`[LocalStorage] 写入失败: ${tx.error?.message}`));
      };
    });
  }

  async deleteFile(key: string): Promise<void> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_BLOBS, STORE_META], 'readwrite');

      tx.objectStore(STORE_BLOBS).delete(key);
      tx.objectStore(STORE_META).delete(key);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(`[LocalStorage] 删除失败: ${tx.error?.message}`));
    });
  }

  async getFileUrl(key: string): Promise<string> {
    const blob = await this.getFileBlob(key);
    if (!blob) {
      throw new Error(`[LocalStorage] 文件不存在: ${key}`);
    }
    return URL.createObjectURL(blob);
  }

  async listFiles(prefix?: string): Promise<StoredFileMeta[]> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const request = store.getAll();

      request.onsuccess = () => {
        let results: StoredFileMeta[] = request.result || [];
        if (prefix) {
          results = results.filter(m => m.key.startsWith(prefix));
        }
        // 按最后修改时间倒序
        results.sort((a, b) => b.lastModified - a.lastModified);
        resolve(results);
      };

      request.onerror = () => {
        reject(new Error(`[LocalStorage] 列表查询失败: ${request.error?.message}`));
      };
    });
  }

  async fileExists(key: string): Promise<boolean> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const request = tx.objectStore(STORE_META).get(key);

      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(new Error(`[LocalStorage] 查询失败: ${request.error?.message}`));
    });
  }

  async getFileBlob(key: string): Promise<Blob | null> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readonly');
      const request = tx.objectStore(STORE_BLOBS).get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(`[LocalStorage] 读取失败: ${request.error?.message}`));
    });
  }

  async dispose(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
