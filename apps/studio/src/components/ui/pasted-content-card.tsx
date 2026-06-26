import { useState } from "react"
import { Copy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PastedContent } from "./types"

export function PastedContentCard({
  content,
  onRemove,
}: {
  content: PastedContent
  onRemove: (id: string) => void
}) {
  const [isExpanded, _setIsExpanded] = useState(false)
  const previewText = content.content.slice(0, 150)
  const needsTruncation = content.content.length > 150

  return (
    <div className="bg-card border border-border relative rounded-lg p-3 size-31.25 shadow-md shrink-0 overflow-hidden">
      <div className="text-[8px] text-foreground/80 whitespace-pre-wrap wrap-break-word max-h-24 overflow-y-auto">
        {isExpanded || !needsTruncation ? content.content : previewText}
        {!isExpanded && needsTruncation && "..."}
      </div>
      <div className="group absolute flex justify-start items-end p-2 inset-0 bg-linear-to-b to-background from-transparent overflow-hidden">
        <p className="capitalize text-foreground text-xs bg-muted border border-border px-2 py-1 rounded-md">
          PASTED
        </p>
        <div className="group-hover:opacity-100 opacity-0 transition-opacity duration-300 flex items-center gap-0.5 absolute top-2 right-2">
          <Button
            size="icon"
            variant="outline"
            className="size-6"
            onClick={() => navigator.clipboard.writeText(content.content)}
            title="Copy content"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-6"
            onClick={() => onRemove(content.id)}
            title="Remove content"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
