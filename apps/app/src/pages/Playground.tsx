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

  const handleSendMessage = (
    message: string,
    files: FileWithPreview[],
    pastedContent: PastedContent[],
  ) => {
    console.log("Message:", message);
    console.log("Files:", files);
    console.log("Pasted Content:", pastedContent);
  };

  return (
    <div className="pt-18 max-w-7xl mx-auto min-h-screen bg-background flex flex-col pb-48">
      <FullscreenPreview product={previewProduct} onClose={() => setPreviewProduct(null)} />

      <div className="px-6 py-8">
        <h1 className="text-2xl font-semibold mb-1">奇想园</h1>
        <p className="text-muted-foreground text-sm">AI 生成记录</p>
      </div>

      <div className="flex-1 px-6 py-6 space-y-8">
        {RECORDS.map((r) => (
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

/* ── Mock data ── */

const RECORDS: Record_[] = [
  {
    id: "1",
    prompt:
      "设计一个极简风格的 logo，以山峰为灵感，加上一些几何元素和渐变色处理，让整体看起来更有层次感",
    tag: "Image",
    time: "2 min",
    details: ["1024×1024", "1:1", "SDXL"],
    references: [
      { type: "Image", label: "参考图", content: "#6366f1 #a855f7" },
      { type: "File", label: "brand-guidelines.pdf", content: "" },
    ],
    products: [
      { type: "Image", content: "#1e3a5f #4facfe" },
      { type: "Image", content: "#2d1b69 #7c3aed" },
      { type: "Image", content: "#065f46 #34d399" },
      { type: "Image", content: "#7c2d12 #f97316" },
    ],
  },
  {
    id: "2",
    prompt: "生成一段带钢琴伴奏的电子音乐，BPM 120，适合做视频开场",
    tag: "Music",
    time: "25 min",
    details: ["3:22", "320kbps", "Stable Audio"],
    products: [{ type: "Music", content: "" }],
  },
  {
    id: "3",
    prompt: "生成 6 张渐变色卡，从紫色到青色过渡，每一张要有不同的纹理质感",
    tag: "Image",
    time: "8 min",
    details: ["1024×1024", "1:1", "Midjourney"],
    products: [
      { type: "Image", content: "#a855f7 #6366f1" },
      { type: "Image", content: "#7c3aed #3b82f6" },
      { type: "Image", content: "#6d28d9 #06b6d4" },
      { type: "Image", content: "#5b21b6 #22d3ee" },
      { type: "Image", content: "#4c1d95 #67e8f9" },
      { type: "Image", content: "#3b0764 #a5f3fc" },
    ],
  },
  {
    id: "4",
    prompt: "为一个独立科幻游戏设计 4 张概念场景图，赛博朋克风格",
    tag: "Image",
    time: "34 min",
    details: ["1920×1080", "16:9", "DALL·E 3"],
    references: [
      { type: "Image", label: "参考概念图", content: "#0f0c29 #302b63" },
    ],
    products: [
      { type: "Image", content: "#0f0c29 #302b63" },
      { type: "Image", content: "#1a0a2e #16213e" },
      { type: "Image", content: "#0f2027 #203a43" },
      { type: "Image", content: "#0d324d #7f5a83" },
    ],
  },
  {
    id: "5",
    prompt: "生成 30 秒产品展示视频，科技感风格，带动态光效",
    tag: "Video",
    time: "1h 2min",
    details: ["30s", "1080p", "Runway Gen-3"],
    references: [{ type: "Video", label: "参考视频素材", content: "#1e1b4b #3b0764" }],
    products: [
      { type: "Video", content: "#1e1b4b #3b0764" },
      { type: "Video", content: "#0f172a #38bdf8" },
    ],
  },
  {
    id: "6",
    prompt: "为一支 3 分钟的城市宣传片生成背景音乐，大气恢弘",
    tag: "Music",
    time: "45 min",
    details: ["2:58", "320kbps", "Stable Audio"],
    products: [{ type: "Music", content: "" }],
  },
  {
    id: "7",
    prompt: "给这段 2 分钟的产品介绍视频配上中文字幕",
    tag: "Subtitle",
    time: "12 min",
    details: ["SRT", "Whisper"],
    references: [{ type: "File", label: "product-intro-v2.mp4", content: "" }],
    products: [
      {
        type: "Subtitle",
        content:
          "1\n00:00:02,000 --> 00:00:06,000\n欢迎来到我们的产品发布会\n\n2\n00:00:06,500 --> 00:00:12,000\n今天我们将为大家展示一款全新的 AI 创作工具\n\n3\n00:00:13,000 --> 00:00:18,000\n它能够帮助你快速生成图片、音乐和视频内容\n\n4\n00:00:19,000 --> 00:00:24,000\n无需任何专业背景，人人都可以成为创作者",
      },
    ],
  },
  {
    id: "8",
    prompt: "为一首古风歌曲生成 MV 画面，水墨风格，4 个场景",
    tag: "Image",
    time: "1h 10min",
    details: ["1024×1024", "1:1", "Midjourney"],
    products: [
      { type: "Image", content: "#2c3e50 #3498db" },
      { type: "Image", content: "#1a1a2e #e94560" },
      { type: "Image", content: "#0f3443 #34e89e" },
      { type: "Image", content: "#3e1f47 #f39c12" },
    ],
  },
  {
    id: "9",
    prompt: "为这个 AI 生成的风景视频配上英文字幕，要求自然流畅",
    tag: "Subtitle",
    time: "20 min",
    details: ["SRT", "Whisper"],
    products: [
      {
        type: "Subtitle",
        content:
          "1\n00:00:01,000 --> 00:00:05,000\nNature reveals itself in the quietest moments\n\n2\n00:00:06,000 --> 00:00:11,000\nWhere the mountains meet the sky\n\n3\n00:00:12,000 --> 00:00:17,000\nAnd the rivers carve their ancient paths\n\n4\n00:00:18,000 --> 00:00:23,000\nWe are but temporary witnesses to its beauty",
      },
    ],
  },
  {
    id: "10",
    prompt: "为一款手游生成 8 张角色立绘，奇幻风格，角色有不同职业",
    tag: "Image",
    time: "2h 15min",
    details: ["512×768", "2:3", "NovelAI"],
    references: [
      { type: "Image", label: "角色参考 A", content: "#4a0e4e #d4145a" },
      { type: "Image", label: "角色参考 B", content: "#0c3483 #a2b6df" },
      { type: "File", label: "character-sheet.pdf", content: "" },
    ],
    products: [
      { type: "Image", content: "#4a0e4e #d4145a" },
      { type: "Image", content: "#0c3483 #a2b6df" },
      { type: "Image", content: "#1f4037 #99f2c8" },
      { type: "Image", content: "#7b2c13 #e6a11e" },
      { type: "Image", content: "#2c2c54 #a7c5eb" },
      { type: "Image", content: "#3a1c71 #d76d77" },
      { type: "Image", content: "#0d1b2a #1b3a4b" },
      { type: "Image", content: "#4a3f35 #c9b18c" },
    ],
  },
]
