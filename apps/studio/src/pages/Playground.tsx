import { useState } from 'react'
import {
  ClaudeChatInput,
  type FileWithPreview,
  type PastedContent,
} from "@/components/ui/claude-style-ai-input";
import { Play, MoreHorizontal, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { api } from "@/lib/api";
import { useRecords } from "@/hooks/useRecords";

/* ── Full-screen preview ── */

function FullscreenPreview({ product, onClose }: { product: Product | null; onClose: () => void }) {
  if (!product) return null
  const [c1, , c2] = product.content.split(' ')

  let body: React.ReactNode = null
  if (product.type === 'Image') {
    body = (
      <div
        className="rounded-lg min-w-[400px] min-h-[300px]"
        style={{ background: `linear-gradient(135deg, ${c1 || '#6366f1'}, ${c2 || c1 || '#a855f7'})` }}
      />
    )
  } else if (product.type === 'Video') {
    body = (
      <div
        className="rounded-lg min-w-[600px] aspect-video flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${c1 || '#1e1b4b'}, ${c2 || c1 || '#3b0764'})` }}
      >
        <div className="size-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
          <Play className="size-7 text-white fill-white ml-0.5" />
        </div>
      </div>
    )
  } else if (product.type === 'Music') {
    body = (
      <div className="w-96 h-24 flex items-end gap-1 px-4 rounded-lg bg-muted/40">
        {Array.from({ length: 64 }).map((_, i) => (
          <div key={i} className="flex-1 rounded-t-sm bg-foreground/20" style={{ height: `${20 + Math.sin(i * 0.5) * 16 + Math.sin(i * 1.1) * 8}%` }} />
        ))}
      </div>
    )
  } else if (product.type === 'Subtitle') {
    body = (
      <div className="max-w-xl max-h-[60vh] overflow-y-auto bg-muted/40 p-6 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">
        {product.content}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[999] bg-black/80 flex items-center justify-center" onClick={onClose}>
      <div className="max-w-[85vw] max-h-[85vh]" onClick={e => e.stopPropagation()}>
        {body}
      </div>
      <button className="absolute top-6 right-6 size-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 transition-colors cursor-pointer" onClick={onClose}>
        <X className="size-5" />
      </button>
    </div>
  )
}

/* ── Single product preview ── */

function ProductPreview({ product, onPreview }: { product: Product; onPreview?: (p: Product) => void }) {
  const content = (() => {
    if (product.type === "Image") {
      const [c1, , c2] = product.content.split(" ");
      return (
        <div
          className="rounded-lg w-full aspect-4/3 cursor-pointer"
          style={{ background: `linear-gradient(135deg, ${c1 || "#6366f1"}, ${c2 || c1 || "#a855f7"})` }}
          onClick={() => onPreview?.(product)}
        />
      );
    }

    if (product.type === "Video") {
      const [c1, , c2] = product.content.split(" ");
      return (
        <div
          className="rounded-lg w-full aspect-video relative flex items-center justify-center cursor-pointer"
          style={{ background: `linear-gradient(135deg, ${c1 || "#1e1b4b"}, ${c2 || c1 || "#3b0764"})` }}
          onClick={() => onPreview?.(product)}
        >
          <div className="size-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Play className="size-5 text-white fill-white ml-0.5" />
          </div>
        </div>
      );
    }

    if (product.type === "Music") {
      return (
        <div className="rounded-lg bg-muted/30 p-4 min-h-24 flex items-end gap-0.75 justify-center">
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              className="w-1.25 rounded-full bg-foreground/20"
              style={{ height: `${Math.max(3, 6 + Math.sin(i * 0.35) * 18 + Math.sin(i * 0.7) * 10)}px` }}
            />
          ))}
        </div>
      );
    }

    if (product.type === "Subtitle") {
      const lines = product.content.split("\n").filter(Boolean);
      return (
        <div className="rounded-lg bg-muted/40 p-4 space-y-2 text-sm">
          {lines.map((line, i) => {
            const match = line.match(/^(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})\s*(.*)$/);
            if (match) {
              return (
                <div key={i} className="flex gap-3 items-baseline">
                  <span className="shrink-0 text-[11px] text-muted-foreground font-mono">{match[1]} → {match[2]}</span>
                  <span className="text-foreground/80">{match[3]}</span>
                </div>
              );
            }
            if (/^\d+$/.test(line.trim())) return null;
            return <p key={i} className="text-foreground/60 pl-54">{line}</p>;
          })}
        </div>
      );
    }

    return <div className="rounded-lg min-h-24 bg-muted/30" />;
  })();

  return (
    <div className="relative group">
      {content}
      <button
        className="absolute top-2 right-2 size-7 rounded-md bg-black/30 opacity-0 group-hover:opacity-100 hover:bg-black/50 flex items-center justify-center transition-opacity cursor-pointer"
        onClick={(e) => { e.stopPropagation(); console.log('Download', product) }}
        title="下载"
      >
        <Download className="size-3.5 text-white" />
      </button>
    </div>
  )
}

/* ── Product grid ── */

function ProductGrid({ products, onPreview }: { products: Product[]; onPreview?: (p: Product) => void }) {
  const visualKinds = new Set(["Image", "Video"]);
  const allVisual = products.every((p) => visualKinds.has(p.type));

  if (allVisual) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {products.map((p, i) => (
          <ProductPreview key={i} product={p} onPreview={onPreview} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {products.map((p, i) => (
        <ProductPreview key={i} product={p} onPreview={onPreview} />
      ))}
    </div>
  );
}

/* ── Record actions ── */

function RecordActions() {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button variant="ghost" size="sm" onClick={() => {}} className="h-7 px-2 text-xs">
        重新生成
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7">
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onClick={() => {}}>查看详情</DropdownMenuItem>
          <DropdownMenuItem onClick={() => {}}>导出</DropdownMenuItem>
          <DropdownMenuItem onClick={() => {}} className="text-destructive focus:text-destructive focus:bg-destructive/10">
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/* ── Page ── */

export default function Playground() {
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null)
  const { records, loading, refresh } = useRecords()
  const [submitting, setSubmitting] = useState(false)

  // 后端 GenerationRecord → Playground 的 Record_ 形状
  const displayRecords: Record_[] = records.map((r) => {
    const prompt = (r.inputParams.prompt as string) ?? '(无提示词)'
    const tag = r.category === 'video' ? 'Video' : r.category === 'image' ? 'Image' : r.category === 'audio' ? 'Music' : r.category
    const time = new Date(r.createdAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric' })
    const details: string[] = [r.model]
    if (r.inputParams.resolution) details.push(String(r.inputParams.resolution))
    if (r.inputParams.duration) details.push(`${r.inputParams.duration}s`)
    const products: Product[] = r.files.map((f) => {
      const isVideo = (f.mimeType ?? '').startsWith('video')
      const isAudio = (f.mimeType ?? '').startsWith('audio')
      return { type: isVideo ? 'Video' : isAudio ? 'Music' : 'Image', content: f.storagePath }
    })
    return { id: r.id, prompt, tag, time, details, products, status: r.status }
  })

  const handleSendMessage = async (
    message: string,
    _files: FileWithPreview[],
    _pastedContent: PastedContent[],
  ) => {
    if (!message.trim()) return
    setSubmitting(true)
    try {
      // 第一步：用默认 t2v 模型提交生成任务
      const res = await api.api.generate.post({
        model: 'wan2.7-t2v',
        category: 'video',
        subCategory: 'text-to-video',
        inputParams: { prompt: message },
      })
      if (res.error) throw new Error(`HTTP ${res.error.status}`)
      void refresh() // 刷新历史
    } catch (e) {
      console.error('生成失败', e)
    } finally {
      setSubmitting(false)
    }
  };

  return (
    <div className="pt-18 max-w-7xl mx-auto min-h-screen bg-background flex flex-col pb-48">
      <FullscreenPreview product={previewProduct} onClose={() => setPreviewProduct(null)} />

      <div className="px-6 py-8">
        <h1 className="text-2xl font-semibold mb-1">奇想园</h1>
        <p className="text-muted-foreground text-sm">AI 生成记录</p>
      </div>

      <div className="flex-1 px-6 py-6 space-y-8">
        {loading && (
          <p className="text-sm text-muted-foreground">加载中...</p>
        )}
        {!loading && displayRecords.length === 0 && (
          <p className="text-sm text-muted-foreground">还没有生成记录，在下方输入提示词开始创作。</p>
        )}
        {displayRecords.map((r) => (
          <div key={r.id}>
            {/* Prompt row */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm mb-2 max-w-full">
              <span className="line-clamp-2 text-foreground/80 flex-1 min-w-0" title={r.prompt}>
                {r.prompt}
              </span>
              <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {r.tag}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {r.time}
              </span>
              {r.details && r.details.length > 0 && (
                <span className="shrink-0 text-muted-foreground/30 mx-0.5">|</span>
              )}
              {r.details?.map((d, i) => (
                <span key={i} className="shrink-0 flex items-center gap-1.5">
                  {i > 0 && <span className="text-muted-foreground/30">|</span>}
                  <span className="text-[11px] text-muted-foreground">{d}</span>
                </span>
              ))}
              <RecordActions />
            </div>

            <ReferenceBar references={r.references} />

            <ProductGrid products={r.products} onPreview={setPreviewProduct} />
          </div>
        ))}
      </div>

      <div className="fixed left-0 w-full bottom-0 px-6 py-4 flex justify-center">
        <ClaudeChatInput
          onSendMessage={handleSendMessage}
          disabled={submitting}
          placeholder="在想什么？试试粘贴大量文本或上传文件..."
          maxFiles={10}
          maxFileSize={10 * 1024 * 1024}
        />
      </div>
    </div>
  )
}

/* ── Types ── */

interface Product {
  type: string;
  content: string;
}

interface Reference {
  type: "Image" | "Video" | "File";
  label: string;
  content: string;
}

interface Record_ {
  id: string;
  prompt: string;
  tag: string;
  time: string;
  details?: string[];
  products: Product[];
  references?: Reference[];
  status?: string;
}

/* ── Reference bar ── */

function ReferenceBar({ references }: { references?: Reference[] }) {
  if (!references || references.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[11px] text-muted-foreground shrink-0">参考</span>
      <div className="flex items-center gap-1.5">
        {references.map((ref, i) => {
          const [c1, , c2] = ref.content.split(" ");
          return (
            <div
              key={i}
              className="size-6 rounded border border-border shrink-0 cursor-default"
              style={{
                background: `linear-gradient(135deg, ${c1 || "#6366f1"}, ${c2 || c1 || "#a855f7"})`,
              }}
              title={ref.label}
            />
          );
        })}
      </div>
    </div>
  );
}
