/**
 * 存储管理器
 * 根据配置选择对应的 StorageProvider，提供统一 API
 */

import {
  IStorageProvider,
  StorageProviderConfig,
  StorageProviderType,
  StoredFileMeta,
  UploadOptions,
} from './StorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { QiniuProvider } from './QiniuProvider';

export class StorageManager {
  private provider: IStorageProvider;
  private initialized = false;

  constructor(config?: StorageProviderConfig) {
    const providerType: StorageProviderType = config?.type || 'local';

    switch (providerType) {
      case 'qiniu':
        this.provider = new QiniuProvider(config!);
        break;
      case 'local':
      default:
        this.provider = new LocalStorageProvider();
        break;
    }
  }

  /** 获取当前使用的 Provider 类型 */
  get providerType(): StorageProviderType {
    return this.provider.type;
  }

  /** 确保已初始化 */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.provider.initialize();
      this.initialized = true;
    }
  }

  async uploadFile(file: File | Blob, options?: UploadOptions): Promise<StoredFileMeta> {
    await this.ensureInitialized();
    return this.provider.uploadFile(file, options);
  }

  async deleteFile(key: string): Promise<void> {
    await this.ensureInitialized();
    return this.provider.deleteFile(key);
  }

  async getFileUrl(key: string): Promise<string> {
    await this.ensureInitialized();
    return this.provider.getFileUrl(key);
  }

  async listFiles(prefix?: string): Promise<StoredFileMeta[]> {
    await this.ensureInitialized();
    return this.provider.listFiles(prefix);
  }

  async fileExists(key: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.provider.fileExists(key);
  }

  async getFileBlob(key: string): Promise<Blob | null> {
    await this.ensureInitialized();
    return this.provider.getFileBlob(key);
  }

  async dispose(): Promise<void> {
    if (this.initialized) {
      await this.provider.dispose();
      this.initialized = false;
    }
  }
}

/** 根据环境变量创建默认 StorageManager 实例 */
export function createStorageManager(): StorageManager {
  const providerType = (
    (typeof process !== 'undefined' && process.env?.STORAGE_PROVIDER) || 'local'
  ) as StorageProviderType;

  const config: StorageProviderConfig = {
    type: providerType,
    // 七牛云配置
    ...(providerType === 'qiniu' && {
      bucket: process.env?.QINIU_BUCKET || '',
      domain: process.env?.QINIU_DOMAIN || '',
      accessKey: process.env?.QINIU_ACCESS_KEY || '',
      secretKey: process.env?.QINIU_SECRET_KEY || '',
      uploadTokenEndpoint: process.env?.QINIU_TOKEN_ENDPOINT || '/api/qiniu/upload-token',
    }),
  };

  return new StorageManager(config);
}
