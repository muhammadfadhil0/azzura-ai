'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { IconWorld, IconX } from '@tabler/icons-react'
import { useChat } from '@/components/chat/chat-provider'
import { ComposerAttachments } from '@/components/chat/composer-attachments'
import { ComposerDocuments } from '@/components/chat/composer-documents'
import { SendButton } from '@/components/chat/send-button'
import { StopButton } from '@/components/chat/stop-button'
import { ToolMenu } from '@/components/chat/tool-menu'
import type {
  Attachment,
  ComposerPayload,
  DocumentRef,
} from '@/types/chat'

export type { ComposerPayload }

const MAX_HEIGHT = 200
const EXPAND_THRESHOLD = 44

export interface ComposerHandle {
  setText: (value: string) => void
  focus: () => void
}

interface Props {
  onSend: (payload: ComposerPayload) => void
  placeholder?: string
  autoFocus?: boolean
  documents?: DocumentRef[]
  onDocumentPicked?: (file: File) => void
  onRemoveDocument?: (id: string) => void
  blockSendForIndexing?: boolean
  documentUploadDisabled?: boolean
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  {
    onSend,
    placeholder = 'Ask anything',
    autoFocus,
    documents,
    onDocumentPicked,
    onRemoveDocument,
    blockSendForIndexing = false,
    documentUploadDisabled = false,
  },
  ref,
) {
  const { isStreaming, stopStreaming, webSearchEnabled, setWebSearchEnabled } =
    useChat()
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [expanded, setExpanded] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(
    ref,
    () => ({
      setText: (value: string) => {
        setText(value)
        const el = textareaRef.current
        if (el) {
          el.focus()
          el.setSelectionRange(value.length, value.length)
        }
      },
      focus: () => textareaRef.current?.focus(),
    }),
    [],
  )

  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      const next = Math.min(el.scrollHeight, MAX_HEIGHT)
      el.style.height = `${next}px`
      el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
    }

    const sentinel = sentinelRef.current
    if (sentinel) {
      setExpanded(sentinel.scrollHeight > EXPAND_THRESHOLD)
    }
  }, [text])

  useEffect(() => {
    const urls = attachments.map((a) => a.url)
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
    }
  }, [attachments])

  const submit = () => {
    if (isStreaming) return
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return
    onSend({ text: trimmed, attachments, webSearch: webSearchEnabled })
    setText('')
    setAttachments([])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((a) => a.id !== id)
    })
  }

  const disabled =
    blockSendForIndexing ||
    (text.trim().length === 0 && attachments.length === 0)

  const focusFromContainer = (e: React.MouseEvent<HTMLFormElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, textarea, [role="menuitem"]')) return
    textareaRef.current?.focus()
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        onClick={focusFromContainer}
        data-expanded={expanded || undefined}
        className="group/composer relative grid grid-cols-[auto_1fr_auto] cursor-text overflow-clip rounded-[28px] border border-border bg-surface px-2 py-[5px] min-h-[52px] shadow-sm transition-[padding,min-height] duration-200 ease-out [grid-template-areas:'header_header_header'_'leading_primary_trailing'] data-[expanded]:py-[9px] data-[expanded]:[grid-template-areas:'header_header_header'_'primary_primary_primary'_'leading_._trailing'] max-sm:[grid-template-areas:'header_header_header'_'primary_primary_primary'_'leading_._trailing']"
      >
        {/* Sentinel: invisible measurement layer always in collapsed layout so
            expand/collapse decision uses a stable width and never oscillates. */}
        <div
          aria-hidden
          className="pointer-events-none invisible absolute inset-0 grid grid-cols-[auto_1fr_auto] [grid-template-areas:'leading_primary_trailing'] px-2 py-[5px]"
        >
          <div className="size-8 [grid-area:leading]" />
          <div className="flex items-center px-1.5 [grid-area:primary]">
            <div
              ref={sentinelRef}
              className="w-full whitespace-pre-wrap break-words py-2 text-sm leading-5"
            >
              {text || ' '}
            </div>
          </div>
          <div className="size-8 [grid-area:trailing]" />
        </div>

        {(attachments.length > 0 ||
          (documents && documents.length > 0)) && (
          <div className="[grid-area:header]">
            {attachments.length > 0 && (
              <ComposerAttachments
                attachments={attachments}
                onRemove={removeAttachment}
              />
            )}
            {documents && documents.length > 0 && onRemoveDocument && (
              <ComposerDocuments
                documents={documents}
                onRemove={onRemoveDocument}
              />
            )}
          </div>
        )}

        <div className="self-center [grid-area:leading] transition-transform duration-200 ease-out">
          <ToolMenu
            onFiles={(files) => setAttachments((prev) => [...prev, ...files])}
            onDocument={onDocumentPicked}
            documentUploadDisabled={documentUploadDisabled}
            webSearchEnabled={webSearchEnabled}
            onToggleWebSearch={setWebSearchEnabled}
          />
        </div>

        <div className="flex items-center [grid-area:primary] px-1.5 transition-[padding] duration-200 ease-out group-data-[expanded]/composer:px-2.5 max-sm:px-2.5">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            autoFocus={autoFocus}
            className="w-full resize-none bg-transparent py-2 text-sm leading-5 outline-none transition-[height] duration-150 ease-out placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center justify-end gap-2 self-center [grid-area:trailing] transition-transform duration-200 ease-out">
          {webSearchEnabled ? (
            <div className="group/badge flex h-8 cursor-default items-center rounded-full bg-foreground/5 px-2 text-xs text-foreground/80">
              <IconWorld className="size-3.5 shrink-0" />
              <div className="flex max-w-0 items-center overflow-hidden transition-[max-width] duration-300 ease-in-out group-hover/badge:max-w-40">
                <span className="whitespace-nowrap pl-1.5">Pencarian web</span>
                <button
                  type="button"
                  onClick={() => setWebSearchEnabled(false)}
                  aria-label="Matikan pencarian web"
                  className="ml-1 shrink-0"
                >
                  <IconX className="size-3 opacity-60 hover:opacity-100" />
                </button>
              </div>
            </div>
          ) : null}
          {isStreaming ? (
            <StopButton onClick={stopStreaming} />
          ) : (
            <SendButton disabled={disabled} />
          )}
        </div>
      </form>
    </div>
  )
})
