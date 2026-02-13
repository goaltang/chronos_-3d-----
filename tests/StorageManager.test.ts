/**
 * StorageManager 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { StorageManager } from '../services/storage/StorageManager';

describe('StorageManager', () => {
  let manager: StorageManager;

  beforeEach(() => {
    // 默认使用 local provider
    manager = new StorageManager({ type: 'local' });
  });

  afterEach(async () => {
    await manager.dispose();
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });

  it('默认应使用 local provider', () => {
    const defaultManager = new StorageManager();
    expect(defaultManager.providerType).toBe('local');
  });

  it('应该能选择七牛云 provider 类型', () => {
    const qiniuManager = new StorageManager({ type: 'qiniu', bucket: 'test', domain: 'https://cdn.test.com' });
    expect(qiniuManager.providerType).toBe('qiniu');
  });

  it('local provider 应该能完成完整的上传-查询-删除流程', async () => {
    const blob = new Blob(['test data'], { type: 'text/plain' });

    // 上传
    const meta = await manager.uploadFile(blob, { key: 'flow-test.txt' });
    expect(meta.key).toBe('flow-test.txt');

    // 查询存在
    expect(await manager.fileExists('flow-test.txt')).toBe(true);

    // 获取 Blob
    const retrieved = await manager.getFileBlob('flow-test.txt');
    expect(retrieved).not.toBeNull();

    // 列出文件
    const files = await manager.listFiles();
    expect(files.length).toBe(1);

    // 删除
    await manager.deleteFile('flow-test.txt');
    expect(await manager.fileExists('flow-test.txt')).toBe(false);
  });

  it('应该自动初始化（懒初始化）', async () => {
    // 第一次调用 uploadFile 时应自动初始化
    const blob = new Blob(['lazy init'], { type: 'text/plain' });
    const meta = await manager.uploadFile(blob, { key: 'lazy.txt' });
    expect(meta.key).toBe('lazy.txt');
  });
});
