'use client'

import { useEffect, useRef, useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconGlobe } from '@tabler/icons-react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { CanvasRevisionCard } from '@/components/canvas/canvas-revision-card'
import { useChat } from '@/components/chat/chat-provider'
import { useDocumentViewer } from '@/components/chat/document-viewer'
import { MessageActions } from '@/components/chat/message-actions'
import { MessageAttachments } from '@/components/chat/message-attachments'
import type { Message, RagCitation } from '@/types/chat'

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

function useFadingLabel(label: string) {
  const [displayed, setDisplayed] = useState(label)
  const [phase, setPhase] = useState<'in' | 'out'>('in')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (label === displayed && phase === 'in') return
    if (timerRef.current) clearTimeout(timerRef.current)
    setPhase('out')
    timerRef.current = setTimeout(() => {
      setDisplayed(label)
      setPhase('in')
    }, 220)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label])

  return { displayed, phase }
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
  const { searchStatuses, canvasRevisionsByConversation } = useChat()
  const { openDocument } = useDocumentViewer()
  const canvasRevisions = conversationId
    ? (canvasRevisionsByConversation[conversationId] ?? []).filter(
        (r) => r.messageId === message.id,
      )
    : []
  const search = searchStatuses[message.id]
  const renderedContent = transformCitations(message.content)
  const showThinking = isStreaming && message.content === ''
  const showSearching =
    showThinking &&
    (search?.status === 'searching' || search?.status === 'synthesizing')

  let searchingLabel = 'Mencari di web...'
  if (search?.status === 'synthesizing') {
    searchingLabel = search.count
      ? `Membandingkan ${search.count} sumber...`
      : 'Menyusun jawaban...'
  } else if (search?.phase === 'extracted' && search.currentDomain) {
    searchingLabel = `Membaca isi ${search.currentDomain}...`
  } else if (search?.phase === 'reading' && search.currentDomain) {
    searchingLabel = `Membuka ${search.currentDomain}...`
  } else if (search?.phase === 'fallback') {
    searchingLabel = 'Extract gagal, pakai cuplikan saja...'
  } else if (search?.query) {
    searchingLabel = `Mencari "${search.query}"...`
  }

  const { displayed: fadingLabel, phase: fadePhase } = useFadingLabel(searchingLabel)

  return (
    <div className="group/msg flex animate-in fade-in slide-in-from-bottom-2 gap-3 duration-200">
      <div className="flex min-w-0 flex-1 flex-col">
        {message.attachments && message.attachments.length > 0 ? (
          <MessageAttachments attachments={message.attachments} />
        ) : null}
        {showSearching ? (
          <p className="shimmer py-2 text-sm text-muted-foreground" role="status" aria-live="polite">
            {fadingLabel}
          </p>
        ) : showThinking ? (
          <ThinkingDots />
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

function ThinkingDots() {
  return (
    <div
      className="flex items-center gap-1 py-2"
      role="status"
      aria-label="AI is thinking"
    >
      <span className="size-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-foreground/40" />
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
