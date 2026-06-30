'use client'

import { useEffect, useRef, useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconGlobe } from '@tabler/icons-react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { CanvasRevisionCard } from '@/components/canvas/canvas-revision-card'
import { GeneratedFileCard } from '@/components/chat/generated-file-card'
import { useChat } from '@/components/chat/chat-provider'
import { useDocumentViewer } from '@/components/chat/document-viewer'
import { MessageActions } from '@/components/chat/message-actions'
import { MessageAttachments } from '@/components/chat/message-attachments'
import type { Message, RagCitation, SearchStatus } from '@/types/chat'

const CITATION_RE =
  /\[doc:([0-9a-f-]{36})(?:#([a-z]+)=([^\]]+))?\]/gi

function transformCitations(text: string): string {
  return text.replace(CITATION_RE, (_, id: string, key?: string, value?: string) => {
    let label = 'Dokumen'
    let query = ''
    if (key === 'p' && value) {
      label = `hal. ${value}`
      query = `?p=${encodeURIComponent(value)}`
    } else if (key === 'h' && value) {
      label = `§ ${value.length > 28 ? `${value.slice(0, 28)}…` : value}`
      query = `?h=${encodeURIComponent(value)}`
    } else if (key === 'para' && value) {
      label = `¶ ${value}`
      query = `?para=${encodeURIComponent(value)}`
    }
    return ` [${label}](doc://${id}${query})`
  })
}

function parseCitationHref(href: string): RagCitation | null {
  try {
    const u = new URL(href)
    if (u.protocol !== 'doc:') return null
    const documentId = u.hostname || u.pathname.replace(/^\/+/, '')
    if (!documentId) return null
    const page = u.searchParams.get('p')
    const heading = u.searchParams.get('h')
    const para = u.searchParams.get('para')
    return {
      documentId,
      page: page ? Number(page) : undefined,
      heading: heading ?? undefined,
      paragraphIndex: para ? Number(para) : undefined,
    }
  } catch {
    return null
  }
}

const CITATION_BADGE =
  'inline-flex h-5 items-center gap-1 rounded-full border border-border bg-surface px-2 align-middle text-xs leading-none text-muted-foreground no-underline transition-colors hover:border-foreground/30 hover:text-foreground cursor-pointer'

function Favicon({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <IconGlobe className="size-3 shrink-0 opacity-50" />
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      width={12}
      height={12}
      className="block size-3 shrink-0 rounded-[2px] object-contain"
      onError={() => setFailed(true)}
    />
  )
}

const SOURCE_BADGE =
  'inline-flex h-5 items-center gap-1 overflow-hidden rounded-full border border-border bg-surface px-2 align-middle text-xs leading-none text-muted-foreground no-underline transition-colors hover:border-foreground/30 hover:text-foreground'

const GENERAL_LABELS = [
  'Sedang berpikir...',
  'Membaca konteks...',
  'Menganalisis pertanyaan...',
  'Menyiapkan jawaban...',
]

function getSpecificLabel(search: SearchStatus | undefined): string | null {
  if (!search || search.status === 'done') return null
  if (search.status === 'synthesizing') {
    return search.count ? `Membandingkan ${search.count} sumber...` : 'Menyusun jawaban...'
  }
  if (search.status === 'searching') {
    if (search.phase === 'extracted' && search.currentDomain) return `Membaca isi ${search.currentDomain}...`
    if (search.phase === 'reading' && search.currentDomain) return `Membuka ${search.currentDomain}...`
    if (search.phase === 'fallback') return 'Mengambil cuplikan halaman...'
    if (search.query) return `Mencari "${search.query}"...`
    return 'Mencari di web...'
  }
  if (search.status === 'reading_docs') {
    return search.docQuery ? `Membaca konteks: "${search.docQuery}"...` : 'Membaca dokumen...'
  }
  if (search.status === 'writing_canvas') return 'Menulis canvas...'
  if (search.status === 'running_skill') {
    return search.skillName ? `Menjalankan ${search.skillName}...` : 'Menjalankan skill...'
  }
  return null
}

function useProcessingLabel(search: SearchStatus | undefined, isActive: boolean): { label: string; opacity: number } {
  const [cycleIdx, setCycleIdx] = useState(0)
  const [opacity, setOpacity] = useState(1)
  const mountedRef = useRef(false)

  const specificLabel = getSpecificLabel(search)
  const label = specificLabel ?? GENERAL_LABELS[cycleIdx]

  // Cycle general labels every 2.5s when no specific tool is running
  useEffect(() => {
    if (!isActive || specificLabel !== null) return
    const id = setInterval(() => {
      setCycleIdx((i) => (i + 1) % GENERAL_LABELS.length)
    }, 2500)
    return () => clearInterval(id)
  }, [isActive, specificLabel])

  // Fade on label change (skip on first mount)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    setOpacity(0)
    const t = setTimeout(() => setOpacity(1), 160)
    return () => clearTimeout(t)
  }, [label])

  return { label, opacity }
}

interface Props {
  message: Message
  conversationId?: string
  isStreaming?: boolean
  siblingIndex?: number
  siblingCount?: number
  onPrevSibling?: () => void
  onNextSibling?: () => void
  onRegenerate?: () => void
}

export function MessageAssistant({
  message,
  conversationId,
  isStreaming = false,
  siblingIndex = 1,
  siblingCount = 1,
  onPrevSibling,
  onNextSibling,
  onRegenerate,
}: Props) {
  const {
    searchStatuses,
    canvasRevisionsByConversation,
    generatedFilesByConversation,
  } = useChat()
  const { openDocument } = useDocumentViewer()
  const generatedFiles = conversationId
    ? (generatedFilesByConversation[conversationId] ?? []).filter(
        (f) => f.messageId === message.id,
      )
    : []
  // Canvas revisions that belong to a generated file are already accessible
  // via the file card's "Lihat" button — suppress the duplicate canvas card.
  const fileOwnedRevisionIds = new Set(
    generatedFiles
      .map((f) => f.canvasRevisionId)
      .filter((id): id is string => Boolean(id)),
  )
  const canvasRevisions = conversationId
    ? (canvasRevisionsByConversation[conversationId] ?? []).filter(
        (r) => r.messageId === message.id && !fileOwnedRevisionIds.has(r.id),
      )
    : []
  const search = searchStatuses[message.id]
  const renderedContent = transformCitations(message.content)
  const showThinking = isStreaming && message.content === ''
  const { label: processingLabel, opacity: labelOpacity } = useProcessingLabel(search, showThinking)

  return (
    <div className="group/msg flex animate-in fade-in slide-in-from-bottom-2 gap-3 duration-200">
      <div className="flex min-w-0 flex-1 flex-col">
        {message.attachments && message.attachments.length > 0 ? (
          <MessageAttachments attachments={message.attachments} />
        ) : null}
        {showThinking ? (
          <p
            className="shimmer py-2 text-sm text-muted-foreground"
            style={{ opacity: labelOpacity, transition: 'opacity 0.16s ease' }}
            role="status"
            aria-live="polite"
          >
            {processingLabel}
          </p>
        ) : (
          <div
            className={[
              'prose prose-base dark:prose-invert max-w-none text-base leading-7',
              // First/last block flush with bubble edges
              '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
              // Headings
              'prose-headings:font-semibold prose-headings:mt-5 prose-headings:mb-2',
              'prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-h4:text-base',
              // Paragraphs + lists tightened
              'prose-p:my-3 prose-p:leading-7',
              'prose-ul:my-3 prose-ol:my-3 prose-li:my-1',
              'prose-li:marker:text-foreground/50',
              // Blockquote
              'prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-3 prose-blockquote:not-italic prose-blockquote:text-foreground/80',
              // Code blocks (highlight.js handles syntax colors)
              'prose-pre:my-3 prose-pre:rounded-lg prose-pre:bg-[#0d1117] prose-pre:p-3 prose-pre:overflow-x-auto',
              // Inline code (strip default backtick pseudos, add surface bg)
              "prose-code:bg-surface prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-[''] prose-code:after:content-['']",
              // Inside <pre>, code should be transparent
              '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:rounded-none',
              // Tables — bordered, scrollable on overflow
              'prose-table:my-3 prose-table:w-full prose-table:text-sm prose-table:border prose-table:border-border prose-table:border-collapse',
              'prose-thead:bg-surface',
              'prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-medium',
              'prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2 prose-td:align-top',
              // Horizontal scroll wrapper for wide tables
              '[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto',
              // HR
              'prose-hr:my-5 prose-hr:border-border',
              // Links rendered as badges via custom component — no prose-a styles needed
              'prose-a:no-underline',
            ].join(' ')}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeHighlight, rehypeKatex]}
              urlTransform={(url) => {
                if (url.startsWith('doc://')) return url
                if (/^(https?:|mailto:|tel:|#|\/)/i.test(url)) return url
                return undefined
              }}
              components={{
                a({ href, children }) {
                  if (href && href.startsWith('doc://')) {
                    const citation = parseCitationHref(href)
                    return (
                      <button
                        type="button"
                        onClick={() =>
                          citation ? openDocument(citation) : undefined
                        }
                        className={CITATION_BADGE}
                      >
                        {children}
                      </button>
                    )
                  }
                  let domain = ''
                  try { domain = new URL(href ?? '').hostname.replace(/^www\./, '') } catch { /* ignore */ }
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer" className={SOURCE_BADGE}>
                      {domain ? <Favicon domain={domain} /> : <IconGlobe className="size-3 shrink-0 opacity-50" />}
                      {children}
                    </a>
                  )
                },
              }}
            >
              {renderedContent}
            </ReactMarkdown>
            {isStreaming ? <TypingCaret /> : null}
          </div>
        )}
        {canvasRevisions.length > 0 && !isStreaming ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {canvasRevisions.map((r) => (
              <CanvasRevisionCard key={r.id} revision={r} />
            ))}
          </div>
        ) : null}
        {generatedFiles.length > 0 && !isStreaming ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {generatedFiles.map((f) => (
              <GeneratedFileCard key={f.id} file={f} />
            ))}
          </div>
        ) : null}
        {!isStreaming ? (
          <div className="flex flex-wrap items-center gap-1">
            <MessageActions message={message} onRegenerate={onRegenerate} />
            {search?.sources && search.sources.length > 0 ? (
              <>
                <div className="mx-0.5 h-3 w-px bg-border opacity-0 transition-opacity group-hover/msg:opacity-100" />
                {search.sources.map((s) => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.title}
                    className={`${SOURCE_BADGE} opacity-0 group-hover/msg:opacity-100`}
                  >
                    <Favicon domain={s.domain} />
                    {s.domain}
                  </a>
                ))}
              </>
            ) : null}
            {siblingCount > 1 ? (
              <SiblingNav
                index={siblingIndex}
                count={siblingCount}
                onPrev={onPrevSibling}
                onNext={onNextSibling}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SiblingNav({
  index,
  count,
  onPrev,
  onNext,
}: {
  index: number
  count: number
  onPrev?: () => void
  onNext?: () => void
}) {
  return (
    <div className="flex items-center gap-0.5 text-xs text-muted-foreground opacity-0 transition-opacity group-hover/msg:opacity-100">
      <button
        type="button"
        onClick={onPrev}
        disabled={!onPrev}
        aria-label="Previous version"
        className="rounded p-1 transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <IconChevronLeft className="size-3.5" />
      </button>
      <span className="tabular-nums">
        {index}/{count}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={!onNext}
        aria-label="Next version"
        className="rounded p-1 transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <IconChevronRight className="size-3.5" />
      </button>
    </div>
  )
}


function TypingCaret() {
  return (
    <span
      aria-hidden="true"
      className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-caret-blink bg-foreground align-text-bottom"
    />
  )
}
