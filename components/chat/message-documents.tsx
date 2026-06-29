'use client'

import {
  IconFileText,
  IconFileTypeDocx,
  IconFileTypePdf,
} from '@tabler/icons-react'
import { useDocumentViewer } from '@/components/chat/document-viewer'
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

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

export function MessageDocuments({ documents }: { documents: DocumentRef[] }) {
  const { openDocument } = useDocumentViewer()
  if (documents.length === 0) return null
  return (
    <div className="flex flex-wrap justify-end gap-2 pb-2">
      {documents.map((doc) => (
        <button
          key={doc.id}
          type="button"
          onClick={() => openDocument({ documentId: doc.id })}
          className="group flex items-center gap-2 rounded-xl border border-border bg-background py-1.5 pl-2 pr-2.5 text-xs text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          <FileTypeIcon mimeType={doc.mimeType} />
          <div className="flex min-w-0 flex-col">
            <span className="max-w-[200px] truncate font-medium">
              {doc.name}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {doc.pageCount ? `${doc.pageCount} hal · ` : ''}
              {formatSize(doc.sizeBytes)}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
