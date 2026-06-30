import { SkillValidationError } from '../types'
import { sanitizeFilename } from './docx-spec'

export { sanitizeFilename }

export type PptxAlign = 'left' | 'center' | 'right'
export type PptxValign = 'top' | 'middle' | 'bottom'

export interface PptxRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string
  fontSize?: number
}

export type PptxShape =
  | {
      type: 'title'
      text: string
      subtitle?: string
    }
  | {
      type: 'textbox'
      text: string
      x: number
      y: number
      w: number
      h: number
      align?: PptxAlign
      valign?: PptxValign
      fontSize?: number
      bold?: boolean
      italic?: boolean
      color?: string
      fill?: string
    }
  | {
      type: 'bullet'
      items: string[]
      x: number
      y: number
      w: number
      h: number
      fontSize?: number
    }
  | {
      type: 'image'
      url: string
      x: number
      y: number
      w: number
      h: number
    }
  | {
      type: 'table'
      rows: string[][]
      x: number
      y: number
      w: number
      colWidths?: number[]
    }
  | {
      type: 'shape'
      shape: 'rect' | 'roundRect' | 'ellipse'
      x: number
      y: number
      w: number
      h: number
      fill?: string
      line?: string
      text?: string
      fontSize?: number
      color?: string
      bold?: boolean
    }

export interface PptxSlide {
  background?: string
  shapes: PptxShape[]
}

export interface PptxSpec {
  filename: string
  title?: string
  theme?: 'default' | 'dark' | 'minimal'
  layout?: 'LAYOUT_16x9' | 'LAYOUT_4x3'
  slides: PptxSlide[]
}

export function validatePptxSpec(input: unknown): PptxSpec {
  if (!input || typeof input !== 'object') {
    throw new SkillValidationError('spec harus berupa object')
  }
  const o = input as Record<string, unknown>

  if (typeof o.filename !== 'string' || o.filename.trim() === '') {
    throw new SkillValidationError('field "filename" wajib string non-kosong')
  }
  if (!Array.isArray(o.slides) || o.slides.length === 0) {
    throw new SkillValidationError('field "slides" wajib array dengan minimal 1 slide')
  }

  let theme: PptxSpec['theme'] = 'default'
  if (o.theme !== undefined) {
    if (o.theme !== 'default' && o.theme !== 'dark' && o.theme !== 'minimal') {
      throw new SkillValidationError('theme harus "default", "dark", atau "minimal"')
    }
    theme = o.theme
  }

  let layout: PptxSpec['layout'] = 'LAYOUT_16x9'
  if (o.layout !== undefined) {
    if (o.layout !== 'LAYOUT_16x9' && o.layout !== 'LAYOUT_4x3') {
      throw new SkillValidationError('layout harus "LAYOUT_16x9" atau "LAYOUT_4x3"')
    }
    layout = o.layout
  }

  const slides = o.slides.map((s, i) => validateSlide(s, i))

  return {
    filename: o.filename,
    title: typeof o.title === 'string' ? o.title : undefined,
    theme,
    layout,
    slides,
  }
}

function validateSlide(input: unknown, index: number): PptxSlide {
  const ctx = `slides[${index}]`
  if (!input || typeof input !== 'object') {
    throw new SkillValidationError(`${ctx} harus berupa object`)
  }
  const s = input as Record<string, unknown>

  let background: string | undefined
  if (s.background !== undefined) {
    if (typeof s.background !== 'string' || !/^[0-9A-Fa-f]{6}$/.test(s.background)) {
      throw new SkillValidationError(`${ctx}.background harus hex 6 digit (mis "FFFFFF")`)
    }
    background = s.background.toUpperCase()
  }

  if (!Array.isArray(s.shapes)) {
    throw new SkillValidationError(`${ctx}.shapes wajib array`)
  }

  const shapes = s.shapes.map((sh, si) => validateShape(sh, `${ctx}.shapes[${si}]`))
  return { background, shapes }
}

function requireNum(o: Record<string, unknown>, key: string, ctx: string): number {
  const v = o[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new SkillValidationError(`${ctx}.${key} wajib number`)
  }
  return v
}

function optHex(o: Record<string, unknown>, key: string, ctx: string): string | undefined {
  const v = o[key]
  if (v === undefined) return undefined
  if (typeof v !== 'string' || !/^[0-9A-Fa-f]{6}$/.test(v)) {
    throw new SkillValidationError(`${ctx}.${key} harus hex 6 digit tanpa # (mis "FF0000")`)
  }
  return v.toUpperCase()
}

function optBool(o: Record<string, unknown>, key: string): boolean | undefined {
  const v = o[key]
  return v !== undefined ? !!v : undefined
}

function optNum(o: Record<string, unknown>, key: string, ctx: string): number | undefined {
  const v = o[key]
  if (v === undefined) return undefined
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new SkillValidationError(`${ctx}.${key} harus number`)
  }
  return v
}

function validateShape(input: unknown, ctx: string): PptxShape {
  if (!input || typeof input !== 'object') {
    throw new SkillValidationError(`${ctx} harus berupa object`)
  }
  const sh = input as Record<string, unknown>

  switch (sh.type) {
    case 'title': {
      if (typeof sh.text !== 'string') throw new SkillValidationError(`${ctx}.text wajib string`)
      return {
        type: 'title',
        text: sh.text,
        subtitle: typeof sh.subtitle === 'string' ? sh.subtitle : undefined,
      }
    }
    case 'textbox': {
      if (typeof sh.text !== 'string') throw new SkillValidationError(`${ctx}.text wajib string`)
      const align = sh.align as PptxAlign | undefined
      if (align !== undefined && align !== 'left' && align !== 'center' && align !== 'right') {
        throw new SkillValidationError(`${ctx}.align harus left|center|right`)
      }
      const valign = sh.valign as PptxValign | undefined
      if (valign !== undefined && valign !== 'top' && valign !== 'middle' && valign !== 'bottom') {
        throw new SkillValidationError(`${ctx}.valign harus top|middle|bottom`)
      }
      return {
        type: 'textbox',
        text: sh.text,
        x: requireNum(sh, 'x', ctx),
        y: requireNum(sh, 'y', ctx),
        w: requireNum(sh, 'w', ctx),
        h: requireNum(sh, 'h', ctx),
        align,
        valign,
        fontSize: optNum(sh, 'fontSize', ctx),
        bold: optBool(sh, 'bold'),
        italic: optBool(sh, 'italic'),
        color: optHex(sh, 'color', ctx),
        fill: optHex(sh, 'fill', ctx),
      }
    }
    case 'bullet': {
      if (!Array.isArray(sh.items) || sh.items.length === 0) {
        throw new SkillValidationError(`${ctx}.items wajib array non-kosong`)
      }
      const items = sh.items.map((it, ii) => {
        if (typeof it !== 'string') throw new SkillValidationError(`${ctx}.items[${ii}] harus string`)
        return it
      })
      return {
        type: 'bullet',
        items,
        x: requireNum(sh, 'x', ctx),
        y: requireNum(sh, 'y', ctx),
        w: requireNum(sh, 'w', ctx),
        h: requireNum(sh, 'h', ctx),
        fontSize: optNum(sh, 'fontSize', ctx),
      }
    }
    case 'image': {
      if (typeof sh.url !== 'string' || !sh.url.startsWith('https://')) {
        throw new SkillValidationError(`${ctx}.url wajib https URL`)
      }
      return {
        type: 'image',
        url: sh.url,
        x: requireNum(sh, 'x', ctx),
        y: requireNum(sh, 'y', ctx),
        w: requireNum(sh, 'w', ctx),
        h: requireNum(sh, 'h', ctx),
      }
    }
    case 'table': {
      if (!Array.isArray(sh.rows) || sh.rows.length === 0) {
        throw new SkillValidationError(`${ctx}.rows wajib array non-kosong`)
      }
      const rows: string[][] = sh.rows.map((row, ri) => {
        if (!Array.isArray(row)) throw new SkillValidationError(`${ctx}.rows[${ri}] harus array`)
        return row.map((cell, ci) => {
          if (typeof cell !== 'string') throw new SkillValidationError(`${ctx}.rows[${ri}][${ci}] harus string`)
          return cell
        })
      })
      let colWidths: number[] | undefined
      if (sh.colWidths !== undefined) {
        if (!Array.isArray(sh.colWidths)) throw new SkillValidationError(`${ctx}.colWidths harus array`)
        colWidths = sh.colWidths.map((n, ni) => {
          if (typeof n !== 'number') throw new SkillValidationError(`${ctx}.colWidths[${ni}] harus number`)
          return n
        })
      }
      return {
        type: 'table',
        rows,
        x: requireNum(sh, 'x', ctx),
        y: requireNum(sh, 'y', ctx),
        w: requireNum(sh, 'w', ctx),
        colWidths,
      }
    }
    case 'shape': {
      const shapeType = sh.shape
      if (shapeType !== 'rect' && shapeType !== 'roundRect' && shapeType !== 'ellipse') {
        throw new SkillValidationError(`${ctx}.shape harus rect|roundRect|ellipse`)
      }
      return {
        type: 'shape',
        shape: shapeType,
        x: requireNum(sh, 'x', ctx),
        y: requireNum(sh, 'y', ctx),
        w: requireNum(sh, 'w', ctx),
        h: requireNum(sh, 'h', ctx),
        fill: optHex(sh, 'fill', ctx),
        line: optHex(sh, 'line', ctx),
        text: typeof sh.text === 'string' ? sh.text : undefined,
        fontSize: optNum(sh, 'fontSize', ctx),
        color: optHex(sh, 'color', ctx),
        bold: optBool(sh, 'bold'),
      }
    }
    default:
      throw new SkillValidationError(
        `${ctx}.type "${String(sh.type)}" tidak dikenal. Valid: title|textbox|bullet|image|table|shape`,
      )
  }
}
