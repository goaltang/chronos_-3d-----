/**
 * PhotoRepository 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { PhotoRepository } from '../services/data/PhotoRepository';
import { PhotoData } from '../types';

const createMockPhoto = (id: number, overrides?: Partial<PhotoData>): PhotoData => ({
  id,
  url: `https://example.com/photo-${id}.jpg`,
  title: `测试照片 ${id}`,
  year: '2025',
  month: '1月',
  timestamp: Date.now() + id,
  description: `描述 ${id}`,
  ...overrides,
});

describe('PhotoRepository', () => {
  let repo: PhotoRepository;

  beforeEach(async () => {
    repo = new PhotoRepository();
    await repo.initialize();
  });

  afterEach(async () => {
    await repo.dispose();
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });

  it('应该能添加并获取所有照片', async () => {
    const photos = [createMockPhoto(1), createMockPhoto(2), createMockPhoto(3)];
    await repo.add(photos);

    const result = await repo.getAll();
    expect(result.length).toBe(3);
    expect(result.map(p => p.id).sort()).toEqual([1, 2, 3]);
  });

  it('应该能根据 ID 获取单张照片', async () => {
    await repo.add(createMockPhoto(42, { title: '特殊照片' }));

    const photo = await repo.getById(42);
    expect(photo).not.toBeNull();
    expect(photo!.title).toBe('特殊照片');
  });

  it('获取不存在的 ID 应返回 null', async () => {
    const photo = await repo.getById(999);
    expect(photo).toBeNull();
  });

  it('应该能更新照片', async () => {
    await repo.add(createMockPhoto(1, { title: '原始标题' }));

    await repo.update(1, { title: '更新后的标题', description: '新描述' });

    const updated = await repo.getById(1);
    expect(updated!.title).toBe('更新后的标题');
    expect(updated!.description).toBe('新描述');
    // 其他字段保持不变
    expect(updated!.year).toBe('2025');
  });

  it('应该能删除照片', async () => {
    await repo.add([createMockPhoto(1), createMockPhoto(2)]);

    await repo.remove(1);

    const remaining = await repo.getAll();
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(2);
  });

  it('应该能清空所有照片', async () => {
    await repo.add([createMockPhoto(1), createMockPhoto(2), createMockPhoto(3)]);

    await repo.clear();

    const result = await repo.getAll();
    expect(result.length).toBe(0);
  });

  it('存储时应自动去除 File 对象', async () => {
    const mockFile = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
    const photoWithFile = createMockPhoto(1);
    photoWithFile.file = mockFile;

    await repo.add(photoWithFile);

    const retrieved = await repo.getById(1);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.file).toBeUndefined();
  });

  it('添加单张照片也应正常工作', async () => {
    await repo.add(createMockPhoto(1));

    const result = await repo.getAll();
    expect(result.length).toBe(1);
  });

  it('更新不存在的照片不应报错', async () => {
    // 不应抛出异常
    await repo.update(999, { title: '不存在' });
  });
});
