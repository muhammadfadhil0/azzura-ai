'use client'

import {
  IconAlertCircle,
  IconCheck,
  IconFileText,
  IconFileTypeDocx,
  IconFileTypePdf,
  IconLoader2,
  IconX,
} from '@tabler/icons-react'
import type { DocumentRef } from '@/types/chat'

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'application/pdf') {
    return <IconFileTypePdf className="size-4 text-rose-500" />
  }
  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return <IconFileTypeDocx className="size-4 text-blue-500" />
  }
  return <IconFileText className="size-4 text-muted-foreground" />
}

function StatusBadge({ doc }: { doc: DocumentRef }) {
  if (doc.status === 'uploading') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <IconLoader2 className="size-3 animate-spin" />
        Mengunggah
      </span>
    )
  }
  if (doc.status === 'parsing') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <IconLoader2 className="size-3 animate-spin" />
        Membaca
      </span>
    )
  }
  if (doc.status === 'embedding') {
    const { completed = 0, total = 0 } = doc.progress ?? {}
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <IconLoader2 className="size-3 animate-spin" />
        Index {completed}/{total}
      </span>
    )
  }
  if (doc.status === 'ready') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
        <IconCheck className="size-3" />
        {doc.pageCount ? `${doc.pageCount} hal` : 'Siap'}
      </span>
    )
  }
  return (
    <span
      title={doc.error ?? 'Error'}
      className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400"
    >
      <IconAlertCircle className="size-3" />
      Gagal
    </span>
  )
}

interface Props {
  documents: DocumentRef[]
  onRemove: (id: string) => void
}

export function ComposerDocuments({ documents, onRemove }: Props) {
  if (documents.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 px-2 pt-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="group/doc-chip flex items-center gap-2 rounded-xl border border-border bg-muted/40 py-1.5 pl-2 pr-1.5 text-xs"
        >
          <FileTypeIcon mimeType={doc.mimeType} />
          <div className="flex min-w-0 flex-col">
            <span className="max-w-[180px] truncate font-medium">
              {doc.name}
            </span>
            <StatusBadge doc={doc} />
          </div>
          <button
            type="button"
            aria-label={`Hapus ${doc.name}`}
            onClick={() => onRemove(doc.id)}
            className="ml-1 flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <IconX className="size-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
