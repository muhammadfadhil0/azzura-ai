import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import type { Message } from '@/types/chat'
import { buildSystemPrompt } from './system-prompt'

export function toOpenAIMessages(
  messages: Message[],
  opts: { webSearch: boolean },
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

  return [
    { role: 'system', content: buildSystemPrompt({ webSearch: opts.webSearch }) },
    ...converted,
  ]
}
