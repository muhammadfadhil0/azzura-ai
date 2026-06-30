import { SkillValidationError } from '../types'

export interface DocxRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string
}

export type DocxBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | {
      type: 'paragraph'
      align?: 'left' | 'center' | 'right' | 'justify'
      runs: DocxRun[]
    }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | {
      type: 'table'
      columnWidthsPct?: number[]
      rows: string[][]
    }
  | { type: 'image'; url: string; widthMm?: number; caption?: string }
  | { type: 'pageBreak' }

export interface DocxSpec {
  filename: string
  title?: string
  page?: {
    size?: 'A4' | 'Letter'
    orientation?: 'portrait' | 'landscape'
  }
  blocks: DocxBlock[]
}

export function validateDocxSpec(input: unknown): DocxSpec {
  if (!input || typeof input !== 'object') {
    throw new SkillValidationError('spec harus berupa object')
  }
  const o = input as Record<string, unknown>

  if (typeof o.filename !== 'string' || o.filename.trim() === '') {
    throw new SkillValidationError('field "filename" wajib string non-kosong')
  }
  if (!Array.isArray(o.blocks) || o.blocks.length === 0) {
    throw new SkillValidationError(
      'field "blocks" wajib array dengan minimal 1 elemen',
    )
  }
  if (o.title !== undefined && typeof o.title !== 'string') {
    throw new SkillValidationError('field "title" harus string jika diisi')
  }

  let page: DocxSpec['page']
  if (o.page !== undefined) {
    if (!o.page || typeof o.page !== 'object') {
      throw new SkillValidationError('field "page" harus object')
    }
    const p = o.page as Record<string, unknown>
    page = {}
    if (p.size !== undefined) {
      if (p.size !== 'A4' && p.size !== 'Letter') {
        throw new SkillValidationError('page.size harus "A4" atau "Letter"')
      }
      page.size = p.size
    }
    if (p.orientation !== undefined) {
      if (p.orientation !== 'portrait' && p.orientation !== 'landscape') {
        throw new SkillValidationError(
          'page.orientation harus "portrait" atau "landscape"',
        )
      }
      page.orientation = p.orientation
    }
  }

  const blocks = o.blocks.map((b, i) => validateBlock(b, i))

  return {
    filename: o.filename,
    title: o.title as string | undefined,
    page,
    blocks,
  }
}

function validateBlock(input: unknown, index: number): DocxBlock {
  const ctx = `blocks[${index}]`
  if (!input || typeof input !== 'object') {
    throw new SkillValidationError(`${ctx} harus berupa object`)
  }
  const b = input as Record<string, unknown>
  switch (b.type) {
    case 'heading': {
      if (b.level !== 1 && b.level !== 2 && b.level !== 3) {
        throw new SkillValidationError(`${ctx}.level harus 1, 2, atau 3`)
      }
      if (typeof b.text !== 'string') {
        throw new SkillValidationError(`${ctx}.text wajib string`)
      }
      return { type: 'heading', level: b.level, text: b.text }
    }
    case 'paragraph': {
      if (!Array.isArray(b.runs) || b.runs.length === 0) {
        throw new SkillValidationError(
          `${ctx}.runs wajib array dengan minimal 1 run`,
        )
      }
      const runs = b.runs.map((r, ri) => validateRun(r, `${ctx}.runs[${ri}]`))
      let align: 'left' | 'center' | 'right' | 'justify' | undefined
      if (b.align !== undefined) {
        if (
          b.align !== 'left' &&
          b.align !== 'center' &&
          b.align !== 'right' &&
          b.align !== 'justify'
        ) {
          throw new SkillValidationError(
            `${ctx}.align harus salah satu dari left|center|right|justify`,
          )
        }
        align = b.align
      }
      return { type: 'paragraph', align, runs }
    }
    case 'list': {
      if (!Array.isArray(b.items) || b.items.length === 0) {
        throw new SkillValidationError(`${ctx}.items wajib array non-kosong`)
      }
      const items = b.items.map((item, ii) => {
        if (typeof item !== 'string') {
          throw new SkillValidationError(`${ctx}.items[${ii}] harus string`)
        }
        return item
      })
      return {
        type: 'list',
        ordered: b.ordered === true,
        items,
      }
    }
    case 'table': {
      if (!Array.isArray(b.rows) || b.rows.length === 0) {
        throw new SkillValidationError(`${ctx}.rows wajib array non-kosong`)
      }
      const rows: string[][] = b.rows.map((row, ri) => {
        if (!Array.isArray(row)) {
          throw new SkillValidationError(`${ctx}.rows[${ri}] harus array`)
        }
        return row.map((cell, ci) => {
          if (typeof cell !== 'string') {
            throw new SkillValidationError(
              `${ctx}.rows[${ri}][${ci}] harus string`,
            )
          }
          return cell
        })
      })
      let columnWidthsPct: number[] | undefined
      if (b.columnWidthsPct !== undefined) {
        if (!Array.isArray(b.columnWidthsPct)) {
          throw new SkillValidationError(
            `${ctx}.columnWidthsPct harus array number`,
          )
        }
        columnWidthsPct = b.columnWidthsPct.map((n, ni) => {
          if (typeof n !== 'number' || !Number.isFinite(n)) {
            throw new SkillValidationError(
              `${ctx}.columnWidthsPct[${ni}] harus number`,
            )
          }
          return n
        })
        const total = columnWidthsPct.reduce((s, n) => s + n, 0)
        if (Math.abs(total - 100) > 1) {
          throw new SkillValidationError(
            `${ctx}.columnWidthsPct total harus 100, sekarang ${total}`,
          )
        }
        if (columnWidthsPct.length !== rows[0]!.length) {
          throw new SkillValidationError(
            `${ctx}.columnWidthsPct harus sama panjangnya dengan jumlah kolom (${rows[0]!.length})`,
          )
        }
      }
      return { type: 'table', columnWidthsPct, rows }
    }
    case 'image': {
      if (typeof b.url !== 'string' || !b.url.startsWith('https://')) {
        throw new SkillValidationError(
          `${ctx}.url wajib string yang dimulai dengan https://`,
        )
      }
      const widthMm =
        b.widthMm !== undefined
          ? Number(b.widthMm)
          : undefined
      if (widthMm !== undefined && (!Number.isFinite(widthMm) || widthMm <= 0)) {
        throw new SkillValidationError(`${ctx}.widthMm harus number positif`)
      }
      const caption =
        b.caption !== undefined ? String(b.caption) : undefined
      return { type: 'image', url: b.url, widthMm, caption }
    }
    case 'pageBreak':
      return { type: 'pageBreak' }
    default:
      throw new SkillValidationError(
        `${ctx}.type "${String(b.type)}" tidak dikenal. Valid: heading|paragraph|list|table|image|pageBreak`,
      )
  }
}

function validateRun(input: unknown, ctx: string): DocxRun {
  if (!input || typeof input !== 'object') {
    throw new SkillValidationError(`${ctx} harus object`)
  }
  const r = input as Record<string, unknown>
  if (typeof r.text !== 'string') {
    throw new SkillValidationError(`${ctx}.text wajib string`)
  }
  const run: DocxRun = { text: r.text }
  if (r.bold !== undefined) run.bold = !!r.bold
  if (r.italic !== undefined) run.italic = !!r.italic
  if (r.underline !== undefined) run.underline = !!r.underline
  if (r.color !== undefined) {
    if (typeof r.color !== 'string' || !/^[0-9A-Fa-f]{6}$/.test(r.color)) {
      throw new SkillValidationError(
        `${ctx}.color harus hex 6 digit tanpa # (mis "0066CC")`,
      )
    }
    run.color = r.color.toUpperCase()
  }
  return run
}

export function sanitizeFilename(input: string): string {
  return input
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    .replace(/[.\-\s]+$/g, '')
}
