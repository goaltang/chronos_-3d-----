/**
 * LocalStorageProvider 单元测试
 * 使用 fake-indexeddb 模拟 IndexedDB 环境
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LocalStorageProvider } from '../services/storage/LocalStorageProvider';

describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;

  beforeEach(async () => {
    provider = new LocalStorageProvider();
    await provider.initialize();
  });

  afterEach(async () => {
    await provider.dispose();
    // 清除 fake-indexeddb 的数据库
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });

  it('应该正确初始化', () => {
    expect(provider.type).toBe('local');
  });

  it('应该能上传和获取文件', async () => {
    const blob = new Blob(['test content'], { type: 'text/plain' });
    const meta = await provider.uploadFile(blob, { key: 'test/file.txt', mimeType: 'text/plain' });

    expect(meta.key).toBe('test/file.txt');
    expect(meta.size).toBe(blob.size);
    expect(meta.mimeType).toBe('text/plain');
    expect(meta.url).toBeTruthy();
  });

  it('应该能检查文件是否存在', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    await provider.uploadFile(blob, { key: 'exists.txt' });

    expect(await provider.fileExists('exists.txt')).toBe(true);
    expect(await provider.fileExists('not-exists.txt')).toBe(false);
  });

  it('应该能列出所有文件', async () => {
    const blob1 = new Blob(['a'], { type: 'image/jpeg' });
    const blob2 = new Blob(['b'], { type: 'image/png' });

    await provider.uploadFile(blob1, { key: 'photos/1.jpg' });
    await provider.uploadFile(blob2, { key: 'photos/2.png' });

    const allFiles = await provider.listFiles();
    expect(allFiles.length).toBe(2);

    const photosOnly = await provider.listFiles('photos/');
    expect(photosOnly.length).toBe(2);

    const otherFiles = await provider.listFiles('videos/');
    expect(otherFiles.length).toBe(0);
  });

  it('应该能删除文件', async () => {
    const blob = new Blob(['delete me'], { type: 'text/plain' });
    await provider.uploadFile(blob, { key: 'to-delete.txt' });

    expect(await provider.fileExists('to-delete.txt')).toBe(true);

    await provider.deleteFile('to-delete.txt');

    expect(await provider.fileExists('to-delete.txt')).toBe(false);
  });

  it('应该能获取文件 Blob', async () => {
    const content = 'blob content test';
    const blob = new Blob([content], { type: 'text/plain' });
    await provider.uploadFile(blob, { key: 'blob-test.txt' });

    const retrieved = await provider.getFileBlob('blob-test.txt');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.size).toBe(blob.size);
  });

  it('获取不存在的文件 Blob 应返回 null', async () => {
    const result = await provider.getFileBlob('nonexistent.txt');
    expect(result).toBeNull();
  });

  it('上传时应自动生成 key', async () => {
    const blob = new Blob(['auto key'], { type: 'image/jpeg' });
    const meta = await provider.uploadFile(blob);

    expect(meta.key).toMatch(/^photos\//);
    expect(meta.key).toMatch(/\.jpg$/);
  });

  it('上传时应触发进度回调', async () => {
    const progressValues: number[] = [];
    const blob = new Blob(['progress test'], { type: 'text/plain' });

    await provider.uploadFile(blob, {
      key: 'progress.txt',
      onProgress: (p) => progressValues.push(p),
    });

    expect(progressValues).toContain(50);
    expect(progressValues).toContain(100);
  });
});
