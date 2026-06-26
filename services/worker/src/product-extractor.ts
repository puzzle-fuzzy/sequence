import type { QueryTaskOutput } from '@seq/bailian-client'

export interface ExtractedFile {
  url: string
  kind: string
}

/**
 * 从百炼异步任务查询结果提取产物 URL。
 * - video: output.video_url
 * - image: output.results[].url（可能多个）
 * - audio: 同步模型不经 query；异步兜底空
 */
export function extractFromQueryOutput(category: string, output: QueryTaskOutput): ExtractedFile[] {
  if (category === 'video') {
    return output.video_url ? [{ url: output.video_url, kind: 'primary' }] : []
  }
  if (category === 'image') {
    const urls = (output.results ?? [])
      .map((r) => r.url)
      .filter((u): u is string => Boolean(u))
    return urls.map((url, i) => ({ url, kind: i === 0 ? 'primary' : 'extra' }))
  }
  return []
}

/** 从同步 image 响应（choices[].message.content[].image）提取 URL。 */
export function extractFromSyncImage(
  choices: Array<{ message?: { content?: Array<{ image?: string }> } }>,
): ExtractedFile[] {
  const urls: string[] = []
  for (const c of choices) {
    for (const part of c.message?.content ?? []) {
      if (part.image) urls.push(part.image)
    }
  }
  return urls.map((url, i) => ({ url, kind: i === 0 ? 'primary' : 'extra' }))
}
