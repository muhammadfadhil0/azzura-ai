'use client'

import { IconX } from '@tabler/icons-react'
import { useCanvas } from '@/components/canvas/canvas-provider'
import { CanvasContent } from '@/components/canvas/canvas-content'
import { CanvasToolbar } from '@/components/canvas/canvas-toolbar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function CanvasPanel() {
  const { isOpen, title, setTitle, commitTitle, close } = useCanvas()

  return (
    <aside
      aria-hidden={!isOpen}
      className={cn(
        'hidden shrink-0 flex-col overflow-hidden border-l border-border bg-background transition-[width] duration-300 ease-in-out md:flex',
        isOpen ? 'w-[50vw] min-w-[420px] max-w-[920px]' : 'w-0',
      )}
    >
      {isOpen ? (
        <>
          <header className="flex items-center gap-2 border-b border-border px-3 py-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => void commitTitle()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
              aria-label="Judul canvas"
              className="min-w-0 flex-1 bg-transparent px-1 text-sm font-medium outline-none placeholder:text-muted-foreground focus:rounded focus:bg-muted/40"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Tutup canvas"
              onClick={close}
            >
              <IconX className="size-4" />
            </Button>
          </header>
          <CanvasToolbar />
          <CanvasContent />
        </>
      ) : null}
    </aside>
  )
}
