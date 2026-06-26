import { Link } from 'react-router-dom'
import { Search, Image, Music, Video, Subtitles, Clock, ArrowUpRight } from 'lucide-react'

const MOCK_PROJECTS = [
  {
    id: '1',
    name: '品牌 Logo 设计探索',
    description: '为科技初创公司设计的极简风格 logo 方案，以山峰为灵感元素，包含多轮迭代',
    thumbnail: '#1e3a5f #4facfe',
    updated: '2 小时前',
    count: 24,
    type: 'Image' as const,
    status: '进行中' as const,
  },
  {
    id: '2',
    name: '科幻游戏概念场景',
    description: '为独立科幻游戏绘制的 4 张概念场景图，赛博朋克风格，包含夜景和室内场景',
    thumbnail: '#0f0c29 #302b63',
    updated: '昨天',
    count: 16,
    type: 'Image' as const,
    status: '已完成' as const,
  },
  {
    id: '3',
    name: '产品宣传片配乐',
    description: '30 秒产品展示视频的背景音乐制作，科技感风格，含多种乐器编排版本',
    thumbnail: '#1e1b4b #3b0764',
    updated: '3 天前',
    count: 8,
    type: 'Music' as const,
    status: '已完成' as const,
  },
  {
    id: '4',
    name: '角色立绘系列',
    description: '为一款奇幻风格手游生成 8 张不同职业的角色立绘，包含战士、法师、射手等',
    thumbnail: '#4a0e4e #d4145a',
    updated: '5 天前',
    count: 32,
    type: 'Image' as const,
    status: '进行中' as const,
  },
  {
    id: '5',
    name: 'MV 场景分镜',
    description: '为一首古风歌曲生成 4 个 MV 场景画面，水墨风格，配合歌词意境',
    thumbnail: '#2c3e50 #3498db',
    updated: '1 周前',
    count: 12,
    type: 'Image' as const,
    status: '已完成' as const,
  },
  {
    id: '6',
    name: '产品介绍视频字幕',
    description: '为 2 分钟的产品介绍视频生成中英双语字幕，SRT 格式，时间轴精确匹配',
    thumbnail: '#0f172a #38bdf8',
    updated: '1 周前',
    count: 6,
    type: 'Video' as const,
    status: '已完成' as const,
  },
]

const TYPE_ICONS = {
  Image: Image,
  Music: Music,
  Video: Video,
  Subtitle: Subtitles,
}

export default function Projects() {
  return (
    <div className="pt-18 max-w-7xl mx-auto min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 py-8">
        <h1 className="text-2xl font-semibold mb-1">大事记</h1>
        <p className="text-muted-foreground text-sm">所有项目和创作记录</p>
      </div>

      {/* Search bar */}
      <div className="px-6 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索项目..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors"
          />
        </div>
      </div>

      {/* Project grid */}
      <div className="px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
        {MOCK_PROJECTS.map(p => {
          const Icon = TYPE_ICONS[p.type]
          const [c1, , c2] = p.thumbnail.split(' ')
          return (
            <Link
              to={`/projects/${p.id}`}
              key={p.id}
              className="group rounded-xl border border-border bg-card overflow-hidden no-underline transition-all hover:border-primary/40 hover:shadow-md"
            >
              {/* Thumbnail */}
              <div
                className="h-36 relative"
                style={{
                  background: `linear-gradient(135deg, ${c1}, ${c2 || c1})`,
                }}
              >
                <div className="absolute inset-0 bg-linear-to-t from-black/30 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/20 text-white backdrop-blur-sm">
                    <Icon className="size-3" />
                    {p.type}
                  </span>
                  <span className={`
                    inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium backdrop-blur-sm
                    ${p.status === '进行中'
                      ? 'bg-amber-500/20 text-amber-200'
                      : 'bg-emerald-500/20 text-emerald-200'
                    }
                  `}>
                    {p.status}
                  </span>
                </div>
                <ArrowUpRight className="absolute top-3 right-3 size-4 text-white/60 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="text-sm font-medium text-card-foreground mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                  {p.name}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                  {p.description}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Image className="size-3" />
                    {p.count} 个产物
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {p.updated}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
