import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import {
  Plus,
  SlidersHorizontal,
  ArrowUp,
  ImageIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { OverlayScrollbarsComponent } from "overlayscrollbars-react"
import "overlayscrollbars/overlayscrollbars.css"

import type { FileWithPreview, PastedContent, ChatInputProps } from "./types"
import {
  MAX_FILES,
  MAX_FILE_SIZE,
  PASTE_THRESHOLD,
  DEFAULT_MODELS,
  formatFileSize,
  isTextualFile,
  readFileAsText,
} from "./utils"
import { ModelSelectorDropdown } from "./model-selector-dropdown"
import { PastedContentCard } from "./pasted-content-card"
import { FilePreviewCard } from "./file-preview-card"

const ClaudeChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = "How can I help you today?",
  maxFiles = MAX_FILES,
  maxFileSize = MAX_FILE_SIZE,
  acceptedFileTypes,
  models = DEFAULT_MODELS,
  defaultModel,
  onModelChange,
}) => {
  const [message, setMessage] = useState("")
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [pastedContent, setPastedContent] = useState<PastedContent[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [selectedModel, setSelectedModel] = useState(defaultModel || models[0]?.id || "")

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      const maxHeight =
        Number.parseInt(getComputedStyle(textareaRef.current).maxHeight, 10) || 120
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
    }
  }, [message])

  const handleFileSelect = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles) return

      const currentFileCount = files.length
      if (currentFileCount >= maxFiles) {
        alert(`Maximum ${maxFiles} files allowed. Please remove some files to add new ones.`)
        return
      }

      const availableSlots = maxFiles - currentFileCount
      const filesToAdd = Array.from(selectedFiles).slice(0, availableSlots)

      if (selectedFiles.length > availableSlots) {
        alert(
          `You can only add ${availableSlots} more file(s). ${
            selectedFiles.length - availableSlots
          } file(s) were not added.`,
        )
      }

      const newFiles = filesToAdd
        .filter((file) => {
          if (file.size > maxFileSize) {
            alert(
              `File ${file.name} (${formatFileSize(file.size)}) exceeds size limit of ${formatFileSize(maxFileSize)}.`,
            )
            return false
          }
          if (acceptedFileTypes && !acceptedFileTypes.some((type) => file.type.includes(type))) {
            alert(`File type for ${file.name} not supported.`)
            return false
          }
          return true
        })
        .map(
          (file) =>
            ({
              id: Math.random().toString(36).slice(2),
              file,
              preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
              type: file.type || "application/octet-stream",
              uploadStatus: "pending" as const,
              uploadProgress: 0,
            }) as FileWithPreview,
        )

      setFiles((prev) => [...prev, ...newFiles])

      newFiles.forEach((fileToUpload) => {
        if (isTextualFile(fileToUpload.file)) {
          readFileAsText(fileToUpload.file)
            .then((textContent) => {
              setFiles((prev) =>
                prev.map((f) => (f.id === fileToUpload.id ? { ...f, textContent } : f)),
              )
            })
            .catch(() => {
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === fileToUpload.id
                    ? { ...f, textContent: "Error reading file content" }
                    : f,
                ),
              )
            })
        }

        setFiles((prev) =>
          prev.map((f) => (f.id === fileToUpload.id ? { ...f, uploadStatus: "uploading" } : f)),
        )

        let progress = 0
        const interval = setInterval(() => {
          progress += Math.random() * 20 + 5
          if (progress >= 100) {
            progress = 100
            clearInterval(interval)
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileToUpload.id
                  ? { ...f, uploadStatus: "complete", uploadProgress: 100 }
                  : f,
              ),
            )
          } else {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileToUpload.id ? { ...f, uploadProgress: progress } : f,
              ),
            )
          }
        }, 150)
      })
    },
    [files.length, maxFiles, maxFileSize, acceptedFileTypes],
  )

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id)
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview)
      }
      return prev.filter((f) => f.id !== id)
    })
  }, [])

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const clipboardData = e.clipboardData
      const items = clipboardData.items

      const fileItems = Array.from(items).filter((item) => item.kind === "file")
      if (fileItems.length > 0 && files.length < maxFiles) {
        e.preventDefault()
        const pastedFiles = fileItems.map((item) => item.getAsFile()).filter(Boolean) as File[]
        const dataTransfer = new DataTransfer()
        pastedFiles.forEach((file) => dataTransfer.items.add(file))
        handleFileSelect(dataTransfer.files)
        return
      }

      const textData = clipboardData.getData("text")
      if (textData && textData.length > PASTE_THRESHOLD && pastedContent.length < 5) {
        e.preventDefault()
        setMessage(message + textData.slice(0, PASTE_THRESHOLD) + "...")

        const pastedItem: PastedContent = {
          id: Math.random().toString(36).slice(2),
          content: textData,
          timestamp: new Date(),
          wordCount: textData.split(/\s+/).filter(Boolean).length,
        }

        setPastedContent((prev) => [...prev, pastedItem])
      }
    },
    [handleFileSelect, files.length, maxFiles, pastedContent.length, message],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files) {
        handleFileSelect(e.dataTransfer.files)
      }
    },
    [handleFileSelect],
  )

  const handleSend = useCallback(() => {
    if (disabled || (!message.trim() && files.length === 0 && pastedContent.length === 0)) return
    if (files.some((f) => f.uploadStatus === "uploading")) {
      alert("Please wait for all files to finish uploading.")
      return
    }

    onSendMessage?.(message, files, pastedContent)

    setMessage("")
    files.forEach((file) => {
      if (file.preview) URL.revokeObjectURL(file.preview)
    })
    setFiles([])
    setPastedContent([])
    if (textareaRef.current) textareaRef.current.style.height = "auto"
  }, [message, files, pastedContent, disabled, onSendMessage])

  const handleModelChangeInternal = useCallback(
    (modelId: string) => {
      setSelectedModel(modelId)
      onModelChange?.(modelId)
    },
    [onModelChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const hasContent = message.trim() || files.length > 0 || pastedContent.length > 0
  const canSend = hasContent && !disabled && !files.some((f) => f.uploadStatus === "uploading")

  return (
    <div
      className="relative w-full max-w-4xl mx-auto"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/5 border-2 border-dashed border-blue-500 rounded-xl flex flex-col items-center justify-center pointer-events-none">
          <p className="text-sm text-blue-500 flex items-center gap-2">
            <ImageIcon className="size-4 opacity-50" />
            Drop files here to add to chat
          </p>
        </div>
      )}

      <div className="bg-background border border-border rounded-xl shadow-lg items-end gap-2 min-h-37.5 flex flex-col">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 min-h-25 w-full p-4 focus-within:border-none focus:outline-none focus:border-none border-none outline-none focus-within:ring-0 focus-within:ring-offset-0 focus-within:outline-none max-h-30 resize-none border-0 bg-transparent text-foreground shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60 text-sm sm:text-base overflow-y-auto"
          rows={1}
        />
        <div className="flex items-center gap-2 justify-between w-full px-3 pb-1.5">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground/90 hover:bg-card shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || files.length >= maxFiles}
              title={files.length >= maxFiles ? `Max ${maxFiles} files reached` : "Attach files"}
            >
              <Plus className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground/90 hover:bg-card shrink-0"
              disabled={disabled}
              title="Options (Not implemented)"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {models && models.length > 0 && (
              <ModelSelectorDropdown
                models={models}
                selectedModel={selectedModel}
                onModelChange={handleModelChangeInternal}
              />
            )}

            <Button
              size="icon"
              className={cn(
                "h-9 w-9 p-0 shrink-0 rounded-md transition-colors",
                canSend
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-card text-muted-foreground/60 cursor-not-allowed",
              )}
              onClick={handleSend}
              disabled={!canSend}
              title="Send message"
            >
              <ArrowUp className="h-5 w-5" />
            </Button>
          </div>
        </div>
        {(files.length > 0 || pastedContent.length > 0) && (
          <OverlayScrollbarsComponent
            options={{
              scrollbars: { autoHide: "leave", theme: "os-theme-dark" },
              overflow: { x: "scroll", y: "hidden" },
            }}
            className="border-t border-border w-full bg-muted"
            style={{ maxHeight: "200px" }}
          >
            <div className="flex gap-3 p-3">
              {pastedContent.map((content) => (
                <PastedContentCard
                  key={content.id}
                  content={content}
                  onRemove={(id) => setPastedContent((prev) => prev.filter((c) => c.id !== id))}
                />
              ))}
              {files.map((file) => (
                <FilePreviewCard key={file.id} file={file} onRemove={removeFile} />
              ))}
            </div>
          </OverlayScrollbarsComponent>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept={acceptedFileTypes?.join(",")}
        onChange={(e) => {
          handleFileSelect(e.target.files)
          if (e.target) e.target.value = ""
        }}
      />
    </div>
  )
}

export { ClaudeChatInput }
export type { ChatInputProps, FileWithPreview, PastedContent, ModelOption } from "./types"
