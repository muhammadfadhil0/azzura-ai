import type { ParsedBlock } from '@/lib/rag/parse'

export interface Chunk {
  content: string
  tokenCount: number
  page?: number
  heading?: string | null
  paragraphIndex?: number
}

const TARGET_TOKENS = 800
const OVERLAP_TOKENS = 150
const CHARS_PER_TOKEN = 4

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

export function chunkBlocks(blocks: ParsedBlock[]): Chunk[] {
  const chunks: Chunk[] = []
  let buffer: ParsedBlock[] = []
  let bufferTokens = 0

  const flushBuffer = () => {
    if (buffer.length === 0) return
    const content = buffer.map((b) => b.text).join('\n\n')
    chunks.push({
      content,
      tokenCount: estimateTokens(content),
      page: buffer[0].page,
      heading: buffer[0].heading ?? null,
      paragraphIndex: buffer[0].paragraphIndex,
    })

    const overlap: ParsedBlock[] = []
    let overlapTokens = 0
    for (let i = buffer.length - 1; i >= 0 && overlapTokens < OVERLAP_TOKENS; i--) {
      overlap.unshift(buffer[i])
      overlapTokens += estimateTokens(buffer[i].text)
    }
    buffer = overlap
    bufferTokens = overlapTokens
  }

  for (const block of blocks) {
    const blockTokens = estimateTokens(block.text)

    if (blockTokens > TARGET_TOKENS) {
      if (buffer.length > 0) flushBuffer()
      buffer = []
      bufferTokens = 0
      const subChunks = splitLargeText(block.text)
      for (const sub of subChunks) {
        chunks.push({
          content: sub,
          tokenCount: estimateTokens(sub),
          page: block.page,
          heading: block.heading ?? null,
          paragraphIndex: block.paragraphIndex,
        })
      }
      continue
    }

    if (bufferTokens + blockTokens > TARGET_TOKENS) {
      flushBuffer()
    }
    buffer.push(block)
    bufferTokens += blockTokens
  }

  if (buffer.length > 0) {
    const content = buffer.map((b) => b.text).join('\n\n')
    chunks.push({
      content,
      tokenCount: estimateTokens(content),
      page: buffer[0].page,
      heading: buffer[0].heading ?? null,
      paragraphIndex: buffer[0].paragraphIndex,
    })
  }

  return chunks
}

function splitLargeText(text: string): string[] {
  const targetChars = TARGET_TOKENS * CHARS_PER_TOKEN
  const overlapChars = OVERLAP_TOKENS * CHARS_PER_TOKEN
  const sentences = text.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let buffer = ''

  for (const sent of sentences) {
    if (sent.length > targetChars) {
      if (buffer) {
        chunks.push(buffer)
        buffer = ''
      }
      const step = Math.max(1, targetChars - overlapChars)
      for (let i = 0; i < sent.length; i += step) {
        chunks.push(sent.substring(i, i + targetChars))
      }
      continue
    }
    if (buffer.length + sent.length + 1 > targetChars) {
      chunks.push(buffer)
      const carry = buffer.substring(Math.max(0, buffer.length - overlapChars))
      buffer = carry ? `${carry} ${sent}` : sent
    } else {
      buffer = buffer ? `${buffer} ${sent}` : sent
    }
  }
  if (buffer) chunks.push(buffer)
  return chunks
}
