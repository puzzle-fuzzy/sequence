import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'

/** 后端 generation_records 序列化后的形状 */
export interface RecordFile {
  id: string
  kind: string
  sourceUrl: string | null
  storagePath: string
  mimeType: string | null
  sizeBytes: number | null
}

export interface GenerationRecord {
  id: string
  userId: string
  model: string
  category: string
  subCategory: string
  inputParams: Record<string, unknown>
  outputResult: Record<string, unknown> | null
  status: string
  cost: Record<string, unknown> | null
  dedupeKey: string | null
  files: RecordFile[]
  createdAt: string
  updatedAt: string
}

interface UseRecordsResult {
  records: GenerationRecord[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/** 获取当前用户的生成记录历史。 */
export function useRecords(): UseRecordsResult {
  const [records, setRecords] = useState<GenerationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.api.records.get()
      if (res.error) throw new Error(`HTTP ${res.error.status}`)
      setRecords(((res.data as unknown as { items: GenerationRecord[] })?.items) ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { records, loading, error, refresh }
}
