import { useState, useRef, useEffect } from "react"
import { ChevronDown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ModelOption } from "./types"

export function ModelSelectorDropdown({
  models,
  selectedModel,
  onModelChange,
}: {
  models: ModelOption[]
  selectedModel: string
  onModelChange: (modelId: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedModelData = models.find((m) => m.id === selectedModel) || models[0]
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 px-2.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-card"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate max-w-37.5 sm:max-w-50">{selectedModelData.name}</span>
        <ChevronDown className={cn("ml-1 h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-72 bg-muted border border-border rounded-lg shadow-xl z-20 p-2">
          {models.map((model) => (
            <button
              key={model.id}
              className={cn(
                "w-full text-left p-2.5 rounded-md hover:bg-card transition-colors flex items-center justify-between",
                model.id === selectedModel && "bg-card",
              )}
              onClick={() => {
                onModelChange(model.id)
                setIsOpen(false)
              }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{model.name}</span>
                  {model.badge && (
                    <span className="px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded">
                      {model.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
              </div>
              {model.id === selectedModel && (
                <Check className="h-4 w-4 text-blue-400 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
