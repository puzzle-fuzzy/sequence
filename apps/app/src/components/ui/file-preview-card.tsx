import { Loader2, AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FileWithPreview } from "./types"
import { formatFileSize, getFileTypeLabel, isTextualFile } from "./utils"
import { TextualFilePreviewCard } from "./textual-file-preview-card"

export function FilePreviewCard({
  file,
  onRemove,
}: {
  file: FileWithPreview
  onRemove: (id: string) => void
}) {
  const isImage = file.type.startsWith("image/")
  const isTextual = isTextualFile(file.file)

  if (isTextual) {
    return <TextualFilePreviewCard file={file} onRemove={onRemove} />
  }

  return (
    <div
      className={cn(
        "relative group bg-card border w-fit border-border rounded-lg p-3 size-31.25 shadow-md shrink-0 overflow-hidden",
        isImage ? "p-0" : "p-3",
      )}
    >
      <div className="flex items-start gap-3 size-31.25 overflow-hidden">
        {isImage && file.preview ? (
          <div className="relative size-full rounded-md overflow-hidden bg-accent">
            <img
              src={file.preview || "/placeholder.svg"}
              alt={file.file.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : null}
        {!isImage && (
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="group absolute flex justify-start items-end p-2 inset-0 bg-linear-to-b to-background from-transparent overflow-hidden">
                <p className="absolute bottom-2 left-2 capitalize text-foreground text-xs bg-muted border border-border px-2 py-1 rounded-md">
                  {getFileTypeLabel(file.type)}
                </p>
              </div>
              {file.uploadStatus === "uploading" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
              )}
              {file.uploadStatus === "error" && (
                <AlertCircle className="h-3.5 w-3.5 text-red-400" />
              )}
            </div>
            <p
              className="max-w-[90%] text-xs font-medium text-foreground truncate"
              title={file.file.name}
            >
              {file.file.name}
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              {formatFileSize(file.file.size)}
            </p>
          </div>
        )}
      </div>
      <Button
        size="icon"
        variant="outline"
        className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
        onClick={() => onRemove(file.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
