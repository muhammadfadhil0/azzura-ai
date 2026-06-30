import type { DocxSpec, DocxBlock, DocxRun } from './handlers/docx-spec'
import type { PptxSpec, PptxShape } from './handlers/pptx-spec'
import type { XlsxSpec, XlsxSheet, XlsxCell } from './handlers/xlsx-spec'

// ─── DOCX ────────────────────────────────────────────────────────────────────

export function specToMarkdown(spec: DocxSpec): string {
  const lines: string[] = []
  if (spec.title) {
    lines.push(`# ${spec.title}`, '')
  }
  for (const block of spec.blocks) {
    appendDocxBlock(block, lines)
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function appendDocxBlock(block: DocxBlock, lines: string[]): void {
  switch (block.type) {
    case 'heading': {
      const hashes = '#'.repeat(block.level)
      lines.push(`${hashes} ${block.text}`, '')
      return
    }
    case 'paragraph': {
      lines.push(block.runs.map(runToMarkdown).join(''), '')
      return
    }
    case 'list': {
      block.items.forEach((item, i) => {
        const prefix = block.ordered ? `${i + 1}. ` : '- '
        lines.push(`${prefix}${item}`)
      })
      lines.push('')
      return
    }
    case 'table': {
      const [header, ...rest] = block.rows
      if (!header || header.length === 0) return
      lines.push(`| ${header.map(escapeCell).join(' | ')} |`)
      lines.push(`| ${header.map(() => '---').join(' | ')} |`)
      for (const row of rest) {
        lines.push(`| ${row.map(escapeCell).join(' | ')} |`)
      }
      lines.push('')
      return
    }
    case 'image': {
      const alt = block.caption ? escapeCell(block.caption) : 'image'
      lines.push(`![${alt}](${block.url})`)
      if (block.caption) lines.push(`*${block.caption}*`)
      lines.push('')
      return
    }
    case 'pageBreak': {
      lines.push('---', '')
      return
    }
  }
}

function runToMarkdown(run: DocxRun): string {
  let text = run.text
  if (run.bold && run.italic) text = `***${text}***`
  else if (run.bold) text = `**${text}**`
  else if (run.italic) text = `*${text}*`
  if (run.underline) text = `<u>${text}</u>`
  return text
}

// ─── PPTX ────────────────────────────────────────────────────────────────────

export function pptxSpecToMarkdown(spec: PptxSpec): string {
  const lines: string[] = []
  if (spec.title) lines.push(`# ${spec.title}`, '')

  spec.slides.forEach((slide, i) => {
    lines.push(`## Slide ${i + 1}`, '')
    for (const shape of slide.shapes) {
      appendPptxShape(shape, lines)
    }
  })

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function appendPptxShape(shape: PptxShape, lines: string[]): void {
  switch (shape.type) {
    case 'title':
      lines.push(`### ${shape.text}`)
      if (shape.subtitle) lines.push('', shape.subtitle)
      lines.push('')
      return
    case 'textbox':
      lines.push(shape.text, '')
      return
    case 'bullet':
      for (const item of shape.items) lines.push(`- ${item}`)
      lines.push('')
      return
    case 'table': {
      const [header, ...rest] = shape.rows
      if (!header) return
      lines.push(`| ${header.map(escapeCell).join(' | ')} |`)
      lines.push(`| ${header.map(() => '---').join(' | ')} |`)
      for (const row of rest) lines.push(`| ${row.map(escapeCell).join(' | ')} |`)
      lines.push('')
      return
    }
    case 'image':
      lines.push(`![image](${shape.url})`, '')
      return
    case 'shape':
      if (shape.text) lines.push(`> ${shape.text}`, '')
      return
  }
}

// ─── XLSX ────────────────────────────────────────────────────────────────────

export function xlsxSpecToMarkdown(spec: XlsxSpec): string {
  const lines: string[] = []
  if (spec.sheets.length === 1) {
    lines.push(`# ${spec.sheets[0]!.name}`, '')
    appendXlsxSheet(spec.sheets[0]!, lines)
  } else {
    for (const sheet of spec.sheets) {
      lines.push(`## ${sheet.name}`, '')
      appendXlsxSheet(sheet, lines)
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function appendXlsxSheet(sheet: XlsxSheet, lines: string[]): void {
  if (sheet.columns.length === 0) return

  lines.push(`| ${sheet.columns.map((c) => escapeCell(c.header)).join(' | ')} |`)
  lines.push(`| ${sheet.columns.map(() => '---').join(' | ')} |`)

  const maxRows = Math.min(sheet.rows.length, 50)
  for (let ri = 0; ri < maxRows; ri++) {
    const row = sheet.rows[ri]!
    const cells = sheet.columns.map((_, ci) => {
      const cell = row[ci]
      if (cell === null || cell === undefined) return ''
      if (typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean') {
        return escapeCell(String(cell))
      }
      return escapeCell(String((cell as XlsxCell).value ?? ''))
    })
    lines.push(`| ${cells.join(' | ')} |`)
  }

  if (sheet.rows.length > 50) {
    lines.push(``, `*... dan ${sheet.rows.length - 50} baris lainnya*`)
  }
  lines.push('')
}

// ─── shared ──────────────────────────────────────────────────────────────────

function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}
