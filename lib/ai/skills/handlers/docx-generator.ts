import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from 'docx'
import {
  type DocxBlock,
  type DocxRun,
  type DocxSpec,
  sanitizeFilename,
  validateDocxSpec,
} from './docx-spec'
import { specToMarkdown } from '../preview'
import type { SkillHandler, SkillHandlerResult } from '../types'

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const PAGE_SIZES = {
  A4: { width: 11906, height: 16838 },
  Letter: { width: 12240, height: 15840 },
} as const

const DEFAULT_MARGIN_DXA = 1440 // 1 inch
const IMAGE_MAX_BYTES = 5 * 1024 * 1024
const IMAGE_FETCH_TIMEOUT_MS = 5000

const ALIGNMENT_MAP = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
} as const

const HEADING_LEVELS = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
} as const

export const docxGeneratorHandler: SkillHandler = async (
  args,
  ctx,
): Promise<SkillHandlerResult> => {
  const spec = validateDocxSpec(args)

  const blocks = await buildBlocks(spec, ctx.signal)

  const pageSize = PAGE_SIZES[spec.page?.size ?? 'A4']
  const orientation =
    spec.page?.orientation === 'landscape'
      ? PageOrientation.LANDSCAPE
      : PageOrientation.PORTRAIT

  const doc = new Document({
    creator: 'AI Skills',
    title: spec.title,
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22 },
          paragraph: {
            spacing: { before: 0, after: 0, line: 320 },
          },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 32, bold: true, font: 'Arial' },
          paragraph: {
            spacing: { before: 240, after: 240 },
            outlineLevel: 0,
          },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial' },
          paragraph: {
            spacing: { before: 200, after: 180 },
            outlineLevel: 1,
          },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial' },
          paragraph: {
            spacing: { before: 160, after: 120 },
            outlineLevel: 2,
          },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 720, hanging: 360 } },
              },
            },
          ],
        },
        {
          reference: 'numbers',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 720, hanging: 360 } },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { ...pageSize, orientation },
            margin: {
              top: DEFAULT_MARGIN_DXA,
              right: DEFAULT_MARGIN_DXA,
              bottom: DEFAULT_MARGIN_DXA,
              left: DEFAULT_MARGIN_DXA,
            },
          },
        },
        children: blocks,
      },
    ],
  })

  const fileBuffer = await Packer.toBuffer(doc)
  const fileName = `${sanitizeFilename(spec.filename) || 'dokumen'}.docx`

  const previewMarkdown = specToMarkdown(spec)
  const previewTitle = spec.title?.trim() || sanitizeFilename(spec.filename)

  return {
    fileBuffer: Buffer.from(fileBuffer),
    fileName,
    mimeType: DOCX_MIME,
    previewMarkdown,
    previewTitle,
    llmFeedback: `Dokumen "${previewTitle}" berhasil dibuat (${fileName}, ${fileBuffer.byteLength} bytes). Beri konfirmasi singkat 1 kalimat ke user dalam Bahasa Indonesia dan beri tahu mereka klik tombol Download di kartu. JANGAN ulangi isi dokumen.`,
  }
}

async function buildBlocks(
  spec: DocxSpec,
  signal: AbortSignal | undefined,
): Promise<(Paragraph | Table)[]> {
  const out: (Paragraph | Table)[] = []

  if (spec.title) {
    out.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: spec.title, bold: true })],
      }),
    )
  }

  for (const block of spec.blocks) {
    const rendered = await renderBlock(block, signal)
    for (const item of rendered) out.push(item)
  }

  return out
}

async function renderBlock(
  block: DocxBlock,
  signal: AbortSignal | undefined,
): Promise<(Paragraph | Table)[]> {
  switch (block.type) {
    case 'heading':
      return [
        new Paragraph({
          heading: HEADING_LEVELS[block.level],
          children: [new TextRun({ text: block.text, bold: true })],
        }),
      ]
    case 'paragraph':
      return [
        new Paragraph({
          alignment: block.align ? ALIGNMENT_MAP[block.align] : undefined,
          children: block.runs.map(toTextRun),
        }),
      ]
    case 'list':
      return block.items.map(
        (item) =>
          new Paragraph({
            numbering: {
              reference: block.ordered ? 'numbers' : 'bullets',
              level: 0,
            },
            children: [new TextRun({ text: item })],
          }),
      )
    case 'table':
      return [renderTable(block)]
    case 'image': {
      const para = await renderImage(block, signal)
      return [para]
    }
    case 'pageBreak':
      return [new Paragraph({ children: [new PageBreak()] })]
  }
}

function toTextRun(run: DocxRun): TextRun {
  return new TextRun({
    text: run.text,
    bold: run.bold,
    italics: run.italic,
    underline: run.underline ? { type: UnderlineType.SINGLE } : undefined,
    color: run.color,
  })
}

function renderTable(block: Extract<DocxBlock, { type: 'table' }>): Table {
  const colCount = block.rows[0]!.length
  const totalWidthDxa = 9000
  const colWidthsDxa: number[] = block.columnWidthsPct
    ? block.columnWidthsPct.map((pct) =>
        Math.max(800, Math.floor((pct / 100) * totalWidthDxa)),
      )
    : new Array(colCount).fill(Math.floor(totalWidthDxa / colCount))

  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
  const borders = { top: border, bottom: border, left: border, right: border }

  return new Table({
    width: { size: colWidthsDxa.reduce((s, n) => s + n, 0), type: WidthType.DXA },
    columnWidths: colWidthsDxa,
    rows: block.rows.map((row, rowIdx) => {
      const isHeader = rowIdx === 0
      return new TableRow({
        tableHeader: isHeader,
        children: row.map((cellText, colIdx) => {
          return new TableCell({
            borders,
            width: { size: colWidthsDxa[colIdx]!, type: WidthType.DXA },
            shading: isHeader
              ? { fill: 'D5E8F0', type: ShadingType.CLEAR }
              : undefined,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: cellText, bold: isHeader }),
                ],
              }),
            ],
          })
        }),
      })
    }),
  })
}

async function renderImage(
  block: Extract<DocxBlock, { type: 'image' }>,
  signal: AbortSignal | undefined,
): Promise<Paragraph> {
  try {
    const fetched = await fetchImageBytes(block.url, signal)
    const widthEmu = mmToEmu(block.widthMm ?? 100)
    const aspectGuess = 0.6
    const heightEmu = Math.floor(widthEmu * aspectGuess)
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          type: fetched.type,
          data: fetched.bytes,
          transformation: {
            width: Math.floor(widthEmu / 9525),
            height: Math.floor(heightEmu / 9525),
          },
          altText: {
            title: block.caption ?? 'image',
            description: block.caption ?? 'image',
            name: block.caption ?? 'image',
          },
        }),
      ],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[docx-generator] failed to embed image ${block.url}: ${msg}`)
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: block.caption
            ? `[gambar tidak bisa dimuat: ${block.caption}]`
            : '[gambar tidak bisa dimuat]',
          italics: true,
          color: '888888',
        }),
      ],
    })
  }
}

interface FetchedImage {
  bytes: Buffer
  type: 'png' | 'jpg' | 'gif' | 'bmp'
}

async function fetchImageBytes(
  url: string,
  signal: AbortSignal | undefined,
): Promise<FetchedImage> {
  if (!url.startsWith('https://')) {
    throw new Error('only https URLs allowed')
  }
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    IMAGE_FETCH_TIMEOUT_MS,
  )
  const composite = composeSignals(signal, controller.signal)
  try {
    const res = await fetch(url, { signal: composite })
    if (!res.ok) throw new Error(`fetch failed ${res.status}`)
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > IMAGE_MAX_BYTES) {
      throw new Error(`image too large (${buf.byteLength} bytes)`)
    }
    const type = mimeToImageType(contentType)
    return { bytes: buf, type }
  } finally {
    clearTimeout(timeout)
  }
}

function mimeToImageType(contentType: string): FetchedImage['type'] {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  if (contentType.includes('gif')) return 'gif'
  if (contentType.includes('bmp')) return 'bmp'
  throw new Error(`unsupported image type: ${contentType}`)
}

function composeSignals(
  a: AbortSignal | undefined,
  b: AbortSignal,
): AbortSignal {
  if (!a) return b
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  if (a.aborted || b.aborted) controller.abort()
  else {
    a.addEventListener('abort', onAbort, { once: true })
    b.addEventListener('abort', onAbort, { once: true })
  }
  return controller.signal
}

function mmToEmu(mm: number): number {
  return Math.floor(mm * 36000)
}
