import { eq } from 'drizzle-orm'
import { db, uploadedFiles } from '@seq/db'
import type { ServerConfig } from '../../config'
import { getAssetStorage } from '../../lib/storage-factory'
import { BadRequestError, NotFoundError, ForbiddenError } from '../../lib/app-errors'

const ALLOWED_PREFIXES = ['image/', 'video/', 'audio/']
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export async function uploadFile(config: ServerConfig, userId: string, file: File) {
  const typeOk = ALLOWED_PREFIXES.some((p) => file.type.startsWith(p))
  if (!typeOk) throw new BadRequestError('只允许上传图片、视频或音频文件')
  if (file.size > MAX_FILE_SIZE) throw new BadRequestError('文件大小超出限制（100MB）')

  const storage = getAssetStorage(config)
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = (file.name.split('.').pop() ?? 'bin').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin'
  const filename = `${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}.${ext}`
  const stored = await storage.put('uploads', filename, buffer, file.type)

  const rows = await db
    .insert(uploadedFiles)
    .values({
      userId,
      purpose: 'upload',
      storagePath: stored.storagePath,
      mimeType: file.type,
      sizeBytes: file.size,
      originalFilename: file.name,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('uploadFile: insert returned no row')

  return {
    id: row.id,
    url: stored.publicUrl,
    storagePath: stored.storagePath,
    mimeType: file.type,
    sizeBytes: file.size,
    originalFilename: file.name,
  }
}

export async function deleteUpload(userId: string, fileId: string) {
  const rows = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId)).limit(1)
  const row = rows[0]
  if (!row) throw new NotFoundError('文件不存在')
  if (row.userId !== userId) throw new ForbiddenError('无权删除该文件')
  await db.delete(uploadedFiles).where(eq(uploadedFiles.id, fileId))
  return { ok: true }
}
