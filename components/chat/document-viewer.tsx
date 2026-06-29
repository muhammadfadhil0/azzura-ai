'use client'

import {
  IconAlertCircle,
  IconExternalLink,
  IconFileText,
  IconLoader2,
} from '@tabler/icons-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { RagCitation } from '@/types/chat'

interface PreviewData {
  url: string
  name: string
  mimeType: string
  pageCount: number | null
}

interface ViewerCtx {
  openDocument: (citation: RagCitation) => void
}

const DocumentViewerContext = createContext<ViewerCtx | null>(null)

export function useDocumentViewer(): ViewerCtx {
  const ctx = useContext(DocumentViewerContext)
  if (!ctx) {
    return { openDocument: () => undefined }
  }
  return ctx
}

export function DocumentViewerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [citation, setCitation] = useState<RagCitation | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [textBody, setTextBody] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openDocument = useCallback((next: RagCitation) => {
    setCitation(next)
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!open || !citation) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setPreview(null)
    setTextBody(null)

    void (async () => {
      try {
        const res = await fetch(
          `/api/documents/${encodeURIComponent(citation.documentId)}/preview`,
        )
        if (!res.ok) throw new Error(`Preview failed (${res.status})`)
        const data = (await res.json()) as PreviewData
        if (cancelled) return
        setPreview(data)

        if (
          data.mimeType === 'text/plain' ||
          data.mimeType === 'text/markdown'
        ) {
          const bodyRes = await fetch(data.url)
          if (!bodyRes.ok) throw new Error(`Body fetch failed (${bodyRes.status})`)
          const text = await bodyRes.text()
          if (!cancelled) setTextBody(text)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, citation])

  const value = useMemo(() => ({ openDocument }), [openDocument])

  return (
    <DocumentViewerContext.Provider value={value}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
        >
          <SheetHeader className="border-b border-border">
            <SheetTitle className="flex items-center gap-2 pr-8">
              <IconFileText className="size-4 shrink-0" />
              <span className="truncate">{preview?.name ?? 'Dokumen'}</span>
            </SheetTitle>
            {citation ? (
              <SheetDescription>
                {citation.page !== undefined
                  ? `Halaman ${citation.page}`
                  : citation.heading
                    ? `§ ${citation.heading}`
                    : citation.paragraphIndex !== undefined
                      ? `Paragraf ${citation.paragraphIndex}`
                      : 'Pratinjau dokumen'}
              </SheetDescription>
            ) : null}
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col">
            {loading ? (
              <div className="flex flex-1 items-center justify-center">
                <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <IconAlertCircle className="size-5 text-rose-500" />
                <span>{error}</span>
              </div>
            ) : preview ? (
              <ViewerBody
                preview={preview}
                citation={citation}
                textBody={textBody}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </DocumentViewerContext.Provider>
  )
}

function ViewerBody({
  preview,
  citation,
  textBody,
}: {
  preview: PreviewData
  citation: RagCitation | null
  textBody: string | null
}) {
  if (preview.mimeType === 'application/pdf') {
    const page = citation?.page
    const src = page ? `${preview.url}#page=${page}` : preview.url
    return (
      <iframe
        title={preview.name}
        src={src}
        className="size-full flex-1 border-0"
      />
    )
  }

  if (
    preview.mimeType === 'text/plain' ||
    preview.mimeType === 'text/markdown'
  ) {
    return (
      <div className="flex-1 overflow-auto p-4">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-foreground">
          {textBody ?? ''}
        </pre>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center text-sm text-muted-foreground">
      <p>Pratinjau .docx belum didukung di viewer.</p>
      <a
        href={preview.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
      >
        <IconExternalLink className="size-3.5" />
        Buka di tab baru
      </a>
    </div>
  )
}
