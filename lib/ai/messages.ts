import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import type { Message } from '@/types/chat'
import type { CurrentCanvasInfo } from './tools'
import { buildSystemPrompt } from './system-prompt'

export function toOpenAIMessages(
  messages: Message[],
  opts: {
    webSearch: boolean
    hasRag?: boolean
    canvas?: boolean
    currentCanvas?: CurrentCanvasInfo | null
    model?: string
  },
): ChatCompletionMessageParam[] {
  const converted: ChatCompletionMessageParam[] = messages.map((m) => {
    const imageAttachments =
      m.role === 'user'
        ? (m.attachments ?? []).filter((a) => a.mimeType.startsWith('image/'))
        : []

    if (m.role === 'user' && imageAttachments.length > 0) {
      return {
        role: 'user',
        content: [
          { type: 'text', text: m.content },
          ...imageAttachments.map((a) => ({
            type: 'image_url' as const,
            image_url: { url: a.url },
          })),
        ],
      }
    }

    return { role: m.role, content: m.content }
  })

  const systemMessages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: buildSystemPrompt({
        webSearch: opts.webSearch,
        hasRag: opts.hasRag,
        canvas: opts.canvas,
        hasCanvasContent: Boolean(opts.currentCanvas?.content),
        model: opts.model,
      }),
    },
  ]

  if (opts.canvas && opts.currentCanvas && opts.currentCanvas.content) {
    const c = opts.currentCanvas
    systemMessages.push({
      role: 'system',
      content: `CURRENT CANVAS (judul: "${c.title}", revisi #${c.revisionIndex}, sumber: ${c.source}):
---
${c.content}
---

Kalau user minta revisi terhadap canvas ini, panggil write_canvas lagi dengan mode="patch" (untuk perubahan lokal) atau "replace" (untuk tulis ulang). Selalu kirim FULL content baru, bukan diff.`,
    })
  }

  return [...systemMessages, ...converted]
}
