/**
 * Chronos 存储提供者接口
 * 统一的云存储/本地存储抽象层
 */

export type StorageProviderType = 'local' | 'qiniu';

/** 存储文件的元信息 */
export interface StoredFileMeta {
  key: string;          // 文件唯一标识（如 "photos/1234.jpg"）
  url: string;          // 可访问的 URL
  size: number;         // 文件大小（字节）
  mimeType: string;     // MIME 类型
  lastModified: number; // 最后修改时间戳
}

/** 上传选项 */
export interface UploadOptions {
  key?: string;         // 自定义 key，不传则自动生成
  mimeType?: string;    // MIME 类型
  onProgress?: (percent: number) => void; // 上传进度回调
}

/** 存储提供者配置 */
export interface StorageProviderConfig {
  type: StorageProviderType;
  // 以下为云存储通用字段，本地存储可忽略
  bucket?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
  domain?: string;      // CDN 域名
  uploadTokenEndpoint?: string; // 后端获取上传凭证的 API 地址
}

/**
 * 统一存储提供者接口
 * 所有存储实现（IndexedDB / 七牛云 / 阿里OSS / 腾讯COS）都须实现此接口
 */
export interface IStorageProvider {
  readonly type: StorageProviderType;

  /** 初始化（打开数据库连接 / 验证云端凭证） */
  initialize(): Promise<void>;

  /** 上传文件，返回可访问的文件信息 */
  uploadFile(file: File | Blob, options?: UploadOptions): Promise<StoredFileMeta>;

  /** 删除文件 */
  deleteFile(key: string): Promise<void>;

  /** 获取文件的可访问 URL */
  getFileUrl(key: string): Promise<string>;

  /** 列出所有文件 */
  listFiles(prefix?: string): Promise<StoredFileMeta[]>;

  /** 检查文件是否存在 */
  fileExists(key: string): Promise<boolean>;

  /** 获取文件 Blob（用于下载/本地缓存） */
  getFileBlob(key: string): Promise<Blob | null>;

  /** 释放资源 */
  dispose(): Promise<void>;
}
