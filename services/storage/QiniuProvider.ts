/**
 * 七牛云对象存储 Provider
 * 
 * 架构：
 *   前端 → Vite 服务端中间件获取 Token → 前端直传七牛云 → CDN 域名访问
 *   密钥仅在 Node.js 端使用（server/qiniuServerPlugin.ts）
 */

import {
  IStorageProvider,
  StoredFileMeta,
  UploadOptions,
  StorageProviderConfig,
} from './StorageProvider';

// 七牛云华东区域上传地址（根据你的 Bucket 区域可能需要调整）
const QINIU_UPLOAD_URLS: Record<string, string> = {
  z0: 'https://up-z0.qiniup.com',     // 华东-浙江
  z1: 'https://up-z1.qiniup.com',     // 华北-河北
  z2: 'https://up-z2.qiniup.com',     // 华南-广东
  na0: 'https://up-na0.qiniup.com',   // 北美
  as0: 'https://up-as0.qiniup.com',   // 东南亚
  'cn-east-2': 'https://up-cn-east-2.qiniup.com', // 华东-浙江2
};

export class QiniuProvider implements IStorageProvider {
  readonly type = 'qiniu' as const;
  private config: StorageProviderConfig;
  private uploadUrl: string;
  private tokenEndpoint: string;
  private deleteEndpoint: string;

  constructor(config: StorageProviderConfig) {
    this.config = config;
    // 默认华南区域（根据你的七牛 Bucket 区域选择）
    this.uploadUrl = QINIU_UPLOAD_URLS[config.region || 'z2'] || QINIU_UPLOAD_URLS.z2;
    this.tokenEndpoint = config.uploadTokenEndpoint || '/api/qiniu/upload-token';
    this.deleteEndpoint = '/api/qiniu/delete';
  }

  async initialize(): Promise<void> {
    if (!this.config.domain) {
      throw new Error('[Qiniu] 未配置 CDN 域名，请在 .env.local 中设置 QINIU_DOMAIN');
    }
    console.log('[Qiniu] Provider 已初始化，CDN:', this.config.domain);
  }

  /**
   * 上传文件到七牛云
   * 流程：请求后端获取 Token → 直传七牛云
   */
  async uploadFile(file: File | Blob, options?: UploadOptions): Promise<StoredFileMeta> {
    // 生成文件 key
    const key = options?.key || `photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 1. 从后端获取上传 Token
    const tokenRes = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });

    if (!tokenRes.ok) {
      throw new Error(`[Qiniu] 获取上传 Token 失败: ${tokenRes.status}`);
    }

    const { token } = await tokenRes.json();

    // 2. 构建 FormData 直传七牛云
    const formData = new FormData();
    formData.append('file', file);
    formData.append('token', token);
    formData.append('key', key);

    // 3. 使用 XMLHttpRequest 以支持上传进度
    const result = await new Promise<{ key: string; hash: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (options?.onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            options.onProgress!(Math.round((e.loaded / e.total) * 100));
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error('[Qiniu] 解析上传响应失败'));
          }
        } else {
          reject(new Error(`[Qiniu] 上传失败: ${xhr.status} ${xhr.responseText}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('[Qiniu] 网络错误')));
      xhr.addEventListener('abort', () => reject(new Error('[Qiniu] 上传被中断')));

      xhr.open('POST', this.uploadUrl);
      xhr.send(formData);
    });

    const url = await this.getFileUrl(result.key);

    return {
      key: result.key,
      url,
      size: file.size,
      mimeType: file instanceof File ? file.type : (options?.mimeType || 'application/octet-stream'),
      lastModified: Date.now(),
    };
  }

  async deleteFile(key: string): Promise<void> {
    const res = await fetch(this.deleteEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`[Qiniu] 删除失败: ${res.status} ${body}`);
    }
  }

  async getFileUrl(key: string): Promise<string> {
    if (!this.config.domain) {
      throw new Error('[Qiniu] 未配置 CDN 域名');
    }
    // 确保域名有 http/https 前缀
    const domain = this.config.domain.startsWith('http')
      ? this.config.domain
      : `http://${this.config.domain}`;
    return `${domain}/${key}`;
  }

  async listFiles(_prefix?: string): Promise<StoredFileMeta[]> {
    // 列举文件需要管理 API（密钥操作），前端不支持
    // 照片列表由 IndexedDB (PhotoRepository) 管理
    console.warn('[Qiniu] listFiles 不可用，照片列表由 IndexedDB 管理');
    return [];
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const url = await this.getFileUrl(key);
      const res = await fetch(url, { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getFileBlob(key: string): Promise<Blob | null> {
    try {
      const url = await this.getFileUrl(key);
      const res = await fetch(url);
      return res.ok ? await res.blob() : null;
    } catch {
      return null;
    }
  }

  async dispose(): Promise<void> {
    // 无状态，无需清理
  }
}
