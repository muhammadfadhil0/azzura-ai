'use client'

import {
  IconDownload,
  IconEye,
  IconFileText,
  IconFileTypeDocx,
  IconFileTypePpt,
  IconFileTypeXls,
} from '@tabler/icons-react'
import { useCanvas } from '@/components/canvas/canvas-provider'
import { cn } from '@/lib/utils'
import type { GeneratedFileSummary } from '@/types/skills'

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === DOCX_MIME) {
    return <IconFileTypeDocx className="size-4 text-blue-500" />
  }
  if (mimeType === PPTX_MIME) {
    return <IconFileTypePpt className="size-4 text-orange-500" />
  }
  if (mimeType === XLSX_MIME) {
    return <IconFileTypeXls className="size-4 text-emerald-500" />
  }
  return <IconFileText className="size-4 text-muted-foreground" />
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

interface Props {
  file: GeneratedFileSummary
}

export function GeneratedFileCard({ file }: Props) {
  const { jumpToRevision, isAIWriting, isAnimating } = useCanvas()
  const disabled = isAIWriting || isAnimating
  const sizeLabel = formatSize(file.sizeBytes)

  return (
    <div
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2',
      )}
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
        <FileTypeIcon mimeType={file.mimeType} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="truncate text-sm font-medium">{file.fileName}</div>
        <div className="text-[11px] text-muted-foreground">
          {sizeLabel ? `${sizeLabel} · ` : ''}Siap diunduh
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {file.canvasRevisionId ? (
          <button
            type="button"
            onClick={() => void jumpToRevision(file.canvasRevisionId!)}
            disabled={disabled}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
            title="Buka preview di Canvas"
          >
            <IconEye className="size-3.5" />
            <span>Lihat</span>
          </button>
        ) : null}
        <a
          href={file.downloadUrl}
          className="flex items-center gap-1 rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background transition-opacity hover:opacity-90"
          download={file.fileName}
        >
          <IconDownload className="size-3.5" />
          <span>Download</span>
        </a>
      </div>
    </div>
  )
}
