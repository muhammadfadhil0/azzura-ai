'use client'

import { IconBrush } from '@tabler/icons-react'
import { useCanvas } from '@/components/canvas/canvas-provider'
import { cn } from '@/lib/utils'
import type { CanvasRevisionSummary } from '@/types/canvas'

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, Date.now() - then)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'baru saja'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} menit lalu`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} jam lalu`
  const day = Math.floor(hour / 24)
  if (day < 7) return `${day} hari lalu`
  const week = Math.floor(day / 7)
  if (week < 5) return `${week} minggu lalu`
  const month = Math.floor(day / 30)
  if (month < 12) return `${month} bulan lalu`
  return `${Math.floor(day / 365)} tahun lalu`
}

interface Props {
  revision: CanvasRevisionSummary
}

export function CanvasRevisionCard({ revision }: Props) {
  const { activeRevisionId, jumpToRevision, isAIWriting, isAnimating } = useCanvas()
  const isActive = activeRevisionId === revision.id
  const disabled = isAIWriting || isAnimating
  return (
    <button
      type="button"
      onClick={() => void jumpToRevision(revision.id)}
      disabled={disabled}
      aria-pressed={isActive}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2 text-left transition-colors',
        'hover:border-foreground/30 hover:bg-foreground/[0.03]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        isActive && 'border-foreground/40 bg-foreground/5',
      )}
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
        <IconBrush className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="truncate font-medium">{revision.title}</span>
          <span className="text-muted-foreground">·</span>
          <span className="shrink-0 text-muted-foreground">
            Revisi #{revision.revisionIndex + 1}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {revision.wordCount} kata · {relativeTime(revision.createdAt)}
        </div>
      </div>
      {isActive ? (
        <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground/80">
          Aktif
        </span>
      ) : null}
    </button>
  )
}
