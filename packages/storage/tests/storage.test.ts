import { afterAll, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { AssetStorage, resolveStoragePath } from '../src/storage'
import type { StorageConfig } from '../src/types'

const TMP = join(import.meta.dirname, '.tmp-storage')

const cfg: StorageConfig = { storageRoot: TMP, publicBasePath: '/generate/storage' }
const storage = new AssetStorage(cfg)

afterAll(async () => {
  await rm(TMP, { recursive: true, force: true })
})

describe('AssetStorage (local mode)', () => {
  it('isOSSConfigured is false without oss config', () => {
    expect(storage.isOSSConfigured()).toBe(false)
  })

  it('put writes buffer to local subdir and returns local publicUrl', async () => {
    const result = await storage.put('tasks', 'abc.mp4', Buffer.from('hello'), 'video/mp4')
    expect(result.storagePath).toBe('tasks/abc.mp4')
    expect(result.publicUrl).toBe('/generate/storage/tasks/abc.mp4')
    expect(result.sizeBytes).toBe(5)
    expect(result.mimeType).toBe('video/mp4')
    // 无 OSS → providerUrl 未设
    expect(result.providerUrl).toBeUndefined()
  })

  it('read returns the buffer that was written', async () => {
    await storage.put('tasks', 'r.bin', Buffer.from('xyz'), 'application/octet-stream')
    const buf = await storage.read('tasks/r.bin')
    expect(buf.toString()).toBe('xyz')
  })

  it('put sanitizes path components (no traversal)', async () => {
    const result = await storage.put('tasks', '..%2fevil.mp4', Buffer.from('x'))
    // 非法字符被替换，不会逃出 storageRoot
    expect(result.storagePath).not.toContain('..')
  })

  it('downloadFromUrl fetches remote into local subdir', async () => {
    // 用 data URL 避免网络依赖；fetch 支持 data: scheme
    const dataUrl = 'data:text/plain;base64,' + Buffer.from('remote-content').toString('base64')
    const info = await storage.downloadFromUrl('d123', dataUrl, 'txt')
    expect(info.sourceUrl).toBe(dataUrl)
    expect(info.sizeBytes).toBe('remote-content'.length)
    expect(info.buffer.toString()).toBe('remote-content')
    expect(info.storagePath).toMatch(/^d123\/[a-f0-9]+\.txt$/)
  })
})

describe('resolveStoragePath', () => {
  it('joins storageRoot with sanitized storagePath', () => {
    const p = resolveStoragePath(TMP, 'tasks/abc.mp4')
    expect(p.startsWith(TMP)).toBe(true)
  })
  it('strips traversal attempts (path stays within storageRoot)', () => {
    const p = resolveStoragePath(TMP, '../../../../etc/passwd')
    // 关键安全属性：始终沙箱在 storageRoot 内
    expect(p.startsWith(TMP)).toBe(true)
    // 不向上逃逸出 TMP 目录（无 .. 段残留）
    const rel = p.slice(TMP.length)
    expect(rel).not.toContain('..')
  })
})
