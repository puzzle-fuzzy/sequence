import { serialize } from '@seq/shared'
import type { GenerationRecord, GenerationFile } from '@seq/db'

/** 序列化 record + files 为 API 响应（Date → ISO）。 */
export function toRecordResponse(record: GenerationRecord, files: GenerationFile[] = []) {
  return serialize({
    id: record.id,
    userId: record.userId,
    model: record.model,
    category: record.category,
    subCategory: record.subCategory,
    inputParams: record.inputParams,
    outputResult: record.outputResult,
    status: record.status,
    cost: record.cost,
    dedupeKey: record.dedupeKey,
    files: files.map((f) => ({
      id: f.id,
      kind: f.kind,
      sourceUrl: f.sourceUrl,
      storagePath: f.storagePath,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
    })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  })
}
