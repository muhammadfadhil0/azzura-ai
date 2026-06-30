'use client'

import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconCopy,
  IconEye,
  IconPencil,
  IconPrinter,
} from '@tabler/icons-react'
import { useCanvas } from '@/components/canvas/canvas-provider'
import { Button } from '@/components/ui/button'

export function CanvasToolbar() {
  const {
    canUndo,
    canRedo,
    undo,
    redo,
    copy,
    print,
    viewMode,
    setViewMode,
    isAIWriting,
    isAnimating,
  } = useCanvas()

  const toggleView = () => setViewMode(viewMode === 'preview' ? 'edit' : 'preview')

  return (
    <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Undo"
        onClick={undo}
        disabled={!canUndo}
      >
        <IconArrowBackUp className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Redo"
        onClick={redo}
        disabled={!canRedo}
      >
        <IconArrowForwardUp className="size-4" />
      </Button>

      <div className="mx-1 h-5 w-px bg-border" />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Copy"
        onClick={() => void copy()}
      >
        <IconCopy className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Print"
        onClick={print}
        disabled={isAnimating}
      >
        <IconPrinter className="size-4" />
      </Button>

      {isAIWriting ? (
        <span className="ml-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-foreground/60" />
          Menulis canvas…
        </span>
      ) : null}

      <div className="ml-auto" />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={viewMode === 'edit' ? 'Lihat preview' : 'Edit canvas'}
        onClick={toggleView}
        disabled={isAIWriting}
      >
        {viewMode === 'edit' ? (
          <IconEye className="size-4" />
        ) : (
          <IconPencil className="size-4" />
        )}
      </Button>
    </div>
  )
}
