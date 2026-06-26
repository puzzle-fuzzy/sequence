import { useState } from "react"
import { Loader2, AlertCircle, Copy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FileWithPreview } from "./types"
import { getFileExtension } from "./utils"

export function TextualFilePreviewCard({
  file,
  onRemove,
}: {
  file: FileWithPreview
  onRemove: (id: string) => void
}) {
  const [isExpanded, _setIsExpanded] = useState(false)
  const previewText = file.textContent?.slice(0, 150) || ""
  const needsTruncation = (file.textContent?.length || 0) > 150
  const fileExtension = getFileExtension(file.file.name)

  return (
    <div className="bg-card border border-border relative rounded-lg p-3 size-31.25 shadow-md shrink-0 overflow-hidden">
      <div className="text-[8px] text-foreground/80 whitespace-pre-wrap wrap-break-word max-h-24 overflow-y-auto">
        {file.textContent ? (
          <>
            {isExpanded || !needsTruncation ? file.textContent : previewText}
            {!isExpanded && needsTruncation && "..."}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
      </div>
      <div className="group absolute flex justify-start items-end p-2 inset-0 bg-linear-to-b to-background from-transparent overflow-hidden">
        <p className="capitalize text-foreground text-xs bg-muted border border-border px-2 py-1 rounded-md">
          {fileExtension}
        </p>
        {file.uploadStatus === "uploading" && (
          <div className="absolute top-2 left-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
          </div>
        )}
        {file.uploadStatus === "error" && (
          <div className="absolute top-2 left-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
          </div>
        )}
        <div className="group-hover:opacity-100 opacity-0 transition-opacity duration-300 flex items-center gap-0.5 absolute top-2 right-2">
          {file.textContent && (
            <Button
              size="icon"
              variant="outline"
              className="size-6"
              onClick={() => navigator.clipboard.writeText(file.textContent || "")}
              title="Copy content"
            >
              <Copy className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="icon"
            variant="outline"
            className={cn("size-6")}
            onClick={() => onRemove(file.id)}
            title="Remove file"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
