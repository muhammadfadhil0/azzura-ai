import { extractText, getDocumentProxy } from 'unpdf'
import mammoth from 'mammoth'

export interface ParsedBlock {
  text: string
  page?: number
  heading?: string | null
  paragraphIndex?: number
}

export interface ParseResult {
  blocks: ParsedBlock[]
  pageCount?: number
}

export function countWords(text: string): number {
  const matches = text.match(/\S+/g)
  return matches ? matches.length : 0
}

export function countWordsInBlocks(blocks: ParsedBlock[]): number {
  let total = 0
  for (const b of blocks) total += countWords(b.text)
  return total
}

export const SUPPORTED_DOC_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
])

export async function parseDocument(
  buffer: ArrayBuffer,
  mimeType: string,
  fileName: string,
): Promise<ParseResult> {
  if (mimeType === 'application/pdf') return parsePdf(buffer)
  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return parseDocx(buffer)
  }
  const text = new TextDecoder('utf-8').decode(buffer)
  const isMd = mimeType === 'text/markdown' || /\.md$/i.test(fileName)
  return parseText(text, isMd)
}

async function parsePdf(buffer: ArrayBuffer): Promise<ParseResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text, totalPages } = await extractText(pdf, { mergePages: false })
  const pages = Array.isArray(text) ? text : [text]
  const blocks: ParsedBlock[] = []
  pages.forEach((pageText, idx) => {
    const paragraphs = pageText
      .split(/\n\s*\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
    for (const para of paragraphs) {
      blocks.push({ text: para, page: idx + 1 })
    }
  })
  return { blocks, pageCount: totalPages }
}

async function parseDocx(buffer: ArrayBuffer): Promise<ParseResult> {
  const { value: html } = await mammoth.convertToHtml({
    buffer: Buffer.from(buffer),
  })
  const blocks: ParsedBlock[] = []
  let currentHeading: string | null = null
  const tagRegex = /<(h[1-6]|p)\b[^>]*>([\s\S]*?)<\/\1>/gi
  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase()
    const rawText = decodeHtmlEntities(stripHtmlTags(match[2])).trim()
    if (!rawText) continue
    if (tag.startsWith('h')) {
      currentHeading = rawText
    } else {
      blocks.push({ text: rawText, heading: currentHeading })
    }
  }
  return { blocks }
}

function parseText(content: string, isMarkdown: boolean): ParseResult {
  const paragraphs = content
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (!isMarkdown) {
    const blocks: ParsedBlock[] = paragraphs.map((text, i) => ({
      text,
      paragraphIndex: i + 1,
    }))
    return { blocks }
  }

  const blocks: ParsedBlock[] = []
  let currentHeading: string | null = null
  for (const para of paragraphs) {
    const lines = para.split('\n')
    const headingMatch = lines[0].match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      currentHeading = headingMatch[2].trim()
      const rest = lines.slice(1).join('\n').trim()
      if (rest) blocks.push({ text: rest, heading: currentHeading })
    } else {
      blocks.push({ text: para, heading: currentHeading })
    }
  }
  return { blocks }
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
}
