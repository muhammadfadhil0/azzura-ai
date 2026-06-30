'use client'

import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { useCanvas } from '@/components/canvas/canvas-provider'

const PROSE_CLASSES = [
  'prose prose-base dark:prose-invert max-w-none text-base leading-7',
  '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  'prose-headings:font-semibold prose-headings:mt-5 prose-headings:mb-2',
  'prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base',
  'prose-p:my-3 prose-p:leading-7',
  'prose-ul:my-3 prose-ol:my-3 prose-li:my-1',
  'prose-li:marker:text-foreground/50',
  'prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-3 prose-blockquote:not-italic prose-blockquote:text-foreground/80',
  'prose-pre:my-3 prose-pre:rounded-lg prose-pre:bg-[#0d1117] prose-pre:p-3 prose-pre:overflow-x-auto',
  "prose-code:bg-surface prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-[''] prose-code:after:content-['']",
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:rounded-none',
  'prose-table:my-3 prose-table:w-full prose-table:text-sm prose-table:border prose-table:border-border prose-table:border-collapse',
  'prose-thead:bg-surface',
  'prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-medium',
  'prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2 prose-td:align-top',
  '[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto',
  'prose-hr:my-5 prose-hr:border-border',
].join(' ')

export function CanvasContent() {
  const {
    viewMode,
    isAnimating,
    isAIWriting,
    displayContent,
    sourceContent,
    applyUserEdit,
    title,
  } = useCanvas()

  if (viewMode === 'edit') {
    return (
      <div
        data-canvas-print
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <h1 className="sr-only print:not-sr-only print:mb-4 print:text-2xl print:font-semibold">
          {title}
        </h1>
        <textarea
          value={sourceContent}
          onChange={(e) => applyUserEdit(e.target.value)}
          disabled={isAIWriting || isAnimating}
          spellCheck={false}
          className="h-full w-full flex-1 resize-none bg-transparent p-8 font-mono text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:opacity-60"
          placeholder="Canvas masih kosong. Minta AI menulis sesuatu di chat (mis. 'tulis esai tentang…')."
        />
      </div>
    )
  }

  if (!displayContent && !isAIWriting) {
    return (
      <div
        data-canvas-print
        className="flex min-h-0 flex-1 items-center justify-center px-8 py-6 text-center text-sm text-muted-foreground"
      >
        Canvas masih kosong. Minta AI menulis konten panjang lewat chat — hasilnya
        akan tampil di sini.
      </div>
    )
  }

  return (
    <div
      data-canvas-print
      className="flex min-h-0 flex-1 flex-col overflow-auto px-8 py-6"
    >
      <h1 className="sr-only print:not-sr-only print:mb-4 print:text-2xl print:font-semibold">
        {title}
      </h1>
      {isAnimating || isAIWriting ? (
        <pre className={`${PROSE_CLASSES} whitespace-pre-wrap font-sans`}>
          {displayContent}
        </pre>
      ) : (
        <div className={PROSE_CLASSES}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeHighlight, rehypeKatex]}
          >
            {sourceContent}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}
