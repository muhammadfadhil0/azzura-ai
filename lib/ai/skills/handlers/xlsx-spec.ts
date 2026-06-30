import { SkillValidationError } from '../types'
import { sanitizeFilename } from './docx-spec'

export { sanitizeFilename }

export type XlsxAlign = 'left' | 'center' | 'right'
export type XlsxNumFmt = 'general' | 'number' | 'decimal' | 'currency' | 'percent' | 'date' | 'text'

export interface XlsxCell {
  value: string | number | boolean | null
  bold?: boolean
  italic?: boolean
  color?: string
  fill?: string
  align?: XlsxAlign
  numFmt?: XlsxNumFmt
  wrap?: boolean
}

export interface XlsxColumn {
  header: string
  width?: number
}

export interface XlsxSheet {
  name: string
  columns: XlsxColumn[]
  rows: (XlsxCell | string | number | null)[][]
  frozenRow?: number
}

export interface XlsxSpec {
  filename: string
  sheets: XlsxSheet[]
}

export function validateXlsxSpec(input: unknown): XlsxSpec {
  if (!input || typeof input !== 'object') {
    throw new SkillValidationError('spec harus berupa object')
  }
  const o = input as Record<string, unknown>

  if (typeof o.filename !== 'string' || o.filename.trim() === '') {
    throw new SkillValidationError('field "filename" wajib string non-kosong')
  }
  if (!Array.isArray(o.sheets) || o.sheets.length === 0) {
    throw new SkillValidationError('field "sheets" wajib array dengan minimal 1 sheet')
  }

  const sheets = o.sheets.map((s, i) => validateSheet(s, i))
  return { filename: o.filename, sheets }
}

function validateSheet(input: unknown, index: number): XlsxSheet {
  const ctx = `sheets[${index}]`
  if (!input || typeof input !== 'object') {
    throw new SkillValidationError(`${ctx} harus berupa object`)
  }
  const s = input as Record<string, unknown>

  if (typeof s.name !== 'string' || s.name.trim() === '') {
    throw new SkillValidationError(`${ctx}.name wajib string non-kosong`)
  }
  if (!Array.isArray(s.columns) || s.columns.length === 0) {
    throw new SkillValidationError(`${ctx}.columns wajib array non-kosong`)
  }
  if (!Array.isArray(s.rows)) {
    throw new SkillValidationError(`${ctx}.rows wajib array`)
  }

  const columns: XlsxColumn[] = s.columns.map((col, ci) => {
    if (!col || typeof col !== 'object') {
      throw new SkillValidationError(`${ctx}.columns[${ci}] harus object`)
    }
    const c = col as Record<string, unknown>
    if (typeof c.header !== 'string') {
      throw new SkillValidationError(`${ctx}.columns[${ci}].header wajib string`)
    }
    const width =
      c.width !== undefined && typeof c.width === 'number' && Number.isFinite(c.width)
        ? c.width
        : undefined
    return { header: c.header, width }
  })

  const rows: XlsxSheet['rows'] = s.rows.map((row, ri) => {
    if (!Array.isArray(row)) {
      throw new SkillValidationError(`${ctx}.rows[${ri}] harus array`)
    }
    return row.map((cell, ci) => {
      if (cell === null || typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean') {
        return cell
      }
      if (typeof cell === 'object') {
        return validateCell(cell, `${ctx}.rows[${ri}][${ci}]`)
      }
      throw new SkillValidationError(`${ctx}.rows[${ri}][${ci}] tipe tidak valid`)
    })
  })

  let frozenRow: number | undefined
  if (s.frozenRow !== undefined) {
    if (typeof s.frozenRow !== 'number' || !Number.isInteger(s.frozenRow) || s.frozenRow < 1) {
      throw new SkillValidationError(`${ctx}.frozenRow harus integer >= 1`)
    }
    frozenRow = s.frozenRow
  }

  return { name: s.name.trim().slice(0, 31), columns, rows, frozenRow }
}

const VALID_NUM_FMTS = new Set(['general', 'number', 'decimal', 'currency', 'percent', 'date', 'text'])

function validateCell(input: object, ctx: string): XlsxCell {
  const c = input as Record<string, unknown>
  const value =
    c.value === null ? null
    : typeof c.value === 'string' || typeof c.value === 'number' || typeof c.value === 'boolean'
      ? c.value
      : null

  const cell: XlsxCell = { value }

  if (c.bold !== undefined) cell.bold = !!c.bold
  if (c.italic !== undefined) cell.italic = !!c.italic
  if (c.wrap !== undefined) cell.wrap = !!c.wrap

  if (c.color !== undefined) {
    if (typeof c.color !== 'string' || !/^[0-9A-Fa-f]{6}$/.test(c.color)) {
      throw new SkillValidationError(`${ctx}.color harus hex 6 digit`)
    }
    cell.color = c.color.toUpperCase()
  }
  if (c.fill !== undefined) {
    if (typeof c.fill !== 'string' || !/^[0-9A-Fa-f]{6}$/.test(c.fill)) {
      throw new SkillValidationError(`${ctx}.fill harus hex 6 digit`)
    }
    cell.fill = c.fill.toUpperCase()
  }
  if (c.align !== undefined) {
    if (c.align !== 'left' && c.align !== 'center' && c.align !== 'right') {
      throw new SkillValidationError(`${ctx}.align harus left|center|right`)
    }
    cell.align = c.align
  }
  if (c.numFmt !== undefined) {
    if (!VALID_NUM_FMTS.has(c.numFmt as string)) {
      throw new SkillValidationError(`${ctx}.numFmt tidak valid`)
    }
    cell.numFmt = c.numFmt as XlsxNumFmt
  }

  return cell
}
