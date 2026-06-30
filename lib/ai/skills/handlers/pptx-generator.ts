import PptxGenJS from 'pptxgenjs'
import type { SkillHandler, SkillHandlerResult } from '../types'
import { type PptxShape, type PptxSlide, type PptxSpec, sanitizeFilename, validatePptxSpec } from './pptx-spec'
import { pptxSpecToMarkdown } from '../preview'

const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

const IMAGE_MAX_BYTES = 5 * 1024 * 1024
const IMAGE_FETCH_TIMEOUT_MS = 5000

const THEME_COLORS = {
  default: { bg: 'FFFFFF', title: '1F2937', body: '374151', accent: '3B82F6', header: 'EFF6FF' },
  dark: { bg: '1F2937', title: 'F9FAFB', body: 'D1D5DB', accent: '60A5FA', header: '374151' },
  minimal: { bg: 'FAFAFA', title: '111827', body: '6B7280', accent: '6366F1', header: 'F3F4F6' },
} as const

export const pptxGeneratorHandler: SkillHandler = async (
  args,
  ctx,
): Promise<SkillHandlerResult> => {
  const spec = validatePptxSpec(args)
  const theme = THEME_COLORS[spec.theme ?? 'default']

  const pptx = new PptxGenJS()
  pptx.layout = spec.layout ?? 'LAYOUT_16x9'
  pptx.title = spec.title ?? spec.filename
  pptx.author = 'AI Skills'

  for (const slideSpec of spec.slides) {
    const slide = pptx.addSlide()
    const bg = slideSpec.background ?? theme.bg
    slide.background = { color: bg }

    for (const shape of slideSpec.shapes) {
      await renderShape(pptx, slide, shape, theme, ctx.signal)
    }
  }

  const fileBuffer = Buffer.from(await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer)
  const fileName = `${sanitizeFilename(spec.filename) || 'presentasi'}.pptx`
  const previewMarkdown = pptxSpecToMarkdown(spec)
  const previewTitle = spec.title?.trim() || sanitizeFilename(spec.filename)

  return {
    fileBuffer,
    fileName,
    mimeType: PPTX_MIME,
    previewMarkdown,
    previewTitle,
    llmFeedback: `Presentasi "${previewTitle}" berhasil dibuat (${fileName}, ${fileBuffer.byteLength} bytes, ${spec.slides.length} slide). Beri konfirmasi singkat 1 kalimat ke user dalam Bahasa Indonesia dan beri tahu mereka klik tombol Download di kartu. JANGAN ulangi isi presentasi.`,
  }
}

async function renderShape(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  shape: PptxShape,
  theme: typeof THEME_COLORS[keyof typeof THEME_COLORS],
  signal: AbortSignal | undefined,
): Promise<void> {
  switch (shape.type) {
    case 'title': {
      // Full-width title covering top 40% of slide
      slide.addText(shape.text, {
        x: 0.5, y: 1.2, w: '90%', h: 1.2,
        fontSize: 36, bold: true, color: theme.title,
        align: 'center', valign: 'middle',
        fontFace: 'Arial',
      })
      if (shape.subtitle) {
        slide.addText(shape.subtitle, {
          x: 0.5, y: 2.8, w: '90%', h: 0.8,
          fontSize: 20, color: theme.body,
          align: 'center', valign: 'middle',
          fontFace: 'Arial',
        })
      }
      return
    }
    case 'textbox': {
      slide.addText(shape.text, {
        x: shape.x, y: shape.y, w: shape.w, h: shape.h,
        fontSize: shape.fontSize ?? 18,
        bold: shape.bold,
        italic: shape.italic,
        color: shape.color ?? theme.body,
        align: shape.align ?? 'left',
        valign: shape.valign ?? 'top',
        fill: shape.fill ? { color: shape.fill } : undefined,
        fontFace: 'Arial',
        wrap: true,
      })
      return
    }
    case 'bullet': {
      const bulletText = shape.items.map((item) => ({
        text: item,
        options: { bullet: true, indentLevel: 0, fontSize: shape.fontSize ?? 18, fontFace: 'Arial', color: theme.body },
      }))
      slide.addText(bulletText, {
        x: shape.x, y: shape.y, w: shape.w, h: shape.h,
        fontFace: 'Arial',
      })
      return
    }
    case 'table': {
      const [header, ...bodyRows] = shape.rows
      if (!header) return

      const tableRows: PptxGenJS.TableRow[] = []

      tableRows.push(
        header.map((cell) => ({
          text: cell,
          options: {
            bold: true,
            fill: { color: theme.header },
            color: theme.title,
            fontSize: 14,
            fontFace: 'Arial',
            align: 'left' as const,
          },
        })),
      )

      for (const row of bodyRows) {
        tableRows.push(
          row.map((cell) => ({
            text: cell,
            options: { fontSize: 13, fontFace: 'Arial', color: theme.body, align: 'left' as const },
          })),
        )
      }

      const colW = shape.w / header.length
      const colWidths = shape.colWidths ?? header.map(() => colW)

      slide.addTable(tableRows, {
        x: shape.x,
        y: shape.y,
        w: shape.w,
        colW: colWidths,
        border: { pt: 0.5, color: 'CCCCCC' },
        rowH: 0.4,
      })
      return
    }
    case 'image': {
      try {
        const data = await fetchImageBase64(shape.url, signal)
        slide.addImage({
          data,
          x: shape.x,
          y: shape.y,
          w: shape.w,
          h: shape.h,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[pptx-generator] failed to embed image ${shape.url}: ${msg}`)
        slide.addText(`[gambar tidak bisa dimuat: ${shape.url}]`, {
          x: shape.x, y: shape.y, w: shape.w, h: shape.h,
          color: '888888', italic: true, fontSize: 12, fontFace: 'Arial',
        })
      }
      return
    }
    case 'shape': {
      const shapeTypeMap: Record<string, PptxGenJS.SHAPE_NAME> = {
        rect: pptx.ShapeType.rect,
        roundRect: pptx.ShapeType.roundRect,
        ellipse: pptx.ShapeType.ellipse,
      }
      const pptxShape = shapeTypeMap[shape.shape] ?? pptx.ShapeType.rect
      const opts: PptxGenJS.ShapeProps = {
        x: shape.x, y: shape.y, w: shape.w, h: shape.h,
        fill: { color: shape.fill ?? theme.accent },
        line: { color: shape.line ?? 'transparent', pt: 1 },
      }
      if (shape.text) {
        slide.addText(shape.text, {
          ...opts,
          shape: pptxShape,
          fontSize: shape.fontSize ?? 16,
          color: shape.color ?? 'FFFFFF',
          bold: shape.bold,
          align: 'center',
          valign: 'middle',
          fontFace: 'Arial',
        })
      } else {
        slide.addShape(pptxShape, opts)
      }
      return
    }
  }
}

async function fetchImageBase64(
  url: string,
  signal: AbortSignal | undefined,
): Promise<string> {
  if (!url.startsWith('https://')) throw new Error('only https URLs allowed')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS)
  const composite = composeSignals(signal, controller.signal)
  try {
    const res = await fetch(url, { signal: composite })
    if (!res.ok) throw new Error(`fetch failed ${res.status}`)
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
    const buf = await res.arrayBuffer()
    if (buf.byteLength > IMAGE_MAX_BYTES) throw new Error(`image too large`)
    const ext = contentType.includes('png') ? 'png'
      : contentType.includes('gif') ? 'gif'
      : 'jpg'
    const b64 = Buffer.from(buf).toString('base64')
    return `data:image/${ext};base64,${b64}`
  } finally {
    clearTimeout(timeout)
  }
}

function composeSignals(a: AbortSignal | undefined, b: AbortSignal): AbortSignal {
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
