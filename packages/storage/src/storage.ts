import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { StorageConfig, StoredObjectResult } from './types'

/**
 * 资产存储 — 本地文件系统 ± 阿里云 OSS 双层。
 *
 * - 无 OSS 配置：仅写本地磁盘，publicUrl 指向本地路由。
 * - 有 OSS 配置：写本地后同步上传 OSS，publicUrl 用 OSS URL（保留本地副本）。
 *
 * OSS 上传通过动态 import('ali-oss') 按需加载，避免未配置 OSS 时引入依赖。
 */
export class AssetStorage {
  private readonly config: StorageConfig

  constructor(config: StorageConfig) {
    this.config = config
  }

  /** 是否启用了 OSS。 */
  isOSSConfigured(): boolean {
    return this.config.oss !== undefined
  }

  /** 本地根目录。 */
  get storageRoot(): string {
    return this.config.storageRoot
  }

  /**
   * 写入 buffer 到本地子目录，可选同步 OSS。
   *
   * @param subdir 子目录（如 'tasks'、'uploads'）
   * @param filename 文件名（含扩展名）
   * @param buffer 文件内容
   * @param mimeType MIME 类型
   */
  async put(
    subdir: string,
    filename: string,
    buffer: Buffer,
    mimeType?: string,
  ): Promise<StoredObjectResult> {
    // 沙箱：只保留安全字符，并剔除 .. / . 段，防止目录逃逸
    const sanitizeSegment = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, '').replace(/^\.+/, '')
    const safeSub = sanitizeSegment(subdir)
    const safeName = sanitizeSegment(filename)
    const storagePath = `${safeSub}/${safeName}`
    const absPath = resolve(this.config.storageRoot, safeSub, safeName)
    await mkdir(dirname(absPath), { recursive: true })
    await writeFile(absPath, buffer)

    const localUrl = this.config.publicBasePath
      ? `${this.config.publicBasePath}/${storagePath}`
      : storagePath

    const result: StoredObjectResult = {
      storagePath,
      publicUrl: localUrl,
      mimeType,
      sizeBytes: buffer.length,
    }

    // OSS 启用 → 同步上传，用 OSS URL 作为 publicUrl
    if (this.config.oss) {
      const key = this.buildOSSKey(safeSub, safeName)
      const ossUrl = await this.uploadToOSS(key, buffer, mimeType)
      result.providerUrl = ossUrl
      result.publicUrl = ossUrl
    }

    return result
  }

  /** 读取本地文件为 buffer。 */
  async read(storagePath: string): Promise<Buffer> {
    const abs = resolve(this.config.storageRoot, storagePath)
    return readFile(abs)
  }

  /**
   * 从远程 URL 下载文件到本地（用于落盘 bailian 生成结果）。
   * 返回本地存储路径 + 元信息。
   *
   * @param subdir 本地子目录（通常用 taskId）
   * @param url 远程 URL
   * @param defaultExt 当 URL 无法推断扩展名时的兜底（如 'mp4'）
   */
  async downloadFromUrl(subdir: string, url: string, defaultExt: string): Promise<{
    storagePath: string
    sourceUrl: string
    mimeType: string | null
    sizeBytes: number | null
    originalFilename: string
    buffer: Buffer
  }> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`下载失败 (${res.status}): ${url}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const ct = res.headers.get('content-type')
    const mime = ct ? ct.split(';')[0]!.trim() : null
    const ext = inferExt(url, mime, defaultExt)
    const filename = `${cryptoRandom()}.${ext}`
    const stored = await this.put(subdir, filename, buf, mime ?? undefined)

    return {
      storagePath: stored.storagePath,
      sourceUrl: url,
      mimeType: mime,
      sizeBytes: buf.length,
      originalFilename: filename,
      buffer: buf,
    }
  }

  private buildOSSKey(subdir: string, filename: string): string {
    const prefix = this.config.oss?.uploadPrefix ?? 'sequence'
    return `${prefix}/${subdir}/${filename}`
  }

  private async uploadToOSS(key: string, buffer: Buffer, mimeType?: string): Promise<string> {
    const oss = this.config.oss!
    const client = await this.getOssClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).put(key, buffer, mimeType ? { 'Content-Type': mimeType } : undefined)
    const endpoint = oss.endpoint ?? `https://${oss.bucket}.${oss.region}.aliyuncs.com`
    return `${endpoint}/${key}`
  }

  private ossClientPromise: Promise<unknown> | null = null
  private async getOssClient(): Promise<unknown> {
    if (this.ossClientPromise) return this.ossClientPromise
    if (!this.config.oss) throw new Error('OSS 未配置')
    const oss = this.config.oss
    this.ossClientPromise = import('ali-oss').then((mod) => {
      const OSS = (mod as { default: unknown }).default ?? mod
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, new-cap
      return new (OSS as any)({
        accessKeyId: oss.accessKeyId,
        accessKeySecret: oss.accessKeySecret,
        bucket: oss.bucket,
        region: oss.region,
        endpoint: oss.endpoint,
      })
    })
    return this.ossClientPromise
  }
}

/** 从本地根解析路径（用于 api 层静态文件服务）。严格沙箱：只保留安全段。 */
export function resolveStoragePath(storageRoot: string, storagePath: string): string {
  const segments = storagePath
    .split('/')
    .map((s) => s.replace(/[^a-zA-Z0-9._-]/g, ''))
    .filter((s) => s.length > 0 && s !== '.' && s !== '..')
  return join(resolve(storageRoot), ...segments)
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function inferExt(url: string, mime: string | null, fallback: string): string {
  const fromUrl = url.split('?')[0]!.split('.').pop()
  if (fromUrl && /^[a-zA-Z0-9]{2,5}$/.test(fromUrl)) return fromUrl.toLowerCase()
  if (mime) {
    const map: Record<string, string> = {
      'video/mp4': 'mp4',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
    }
    if (map[mime]) return map[mime]!
  }
  return fallback
}

function cryptoRandom(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}
