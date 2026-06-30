import ExcelJS from 'exceljs'
import type { SkillHandler, SkillHandlerResult } from '../types'
import { type XlsxCell, type XlsxSheet, sanitizeFilename, validateXlsxSpec } from './xlsx-spec'
import { xlsxSpecToMarkdown } from '../preview'

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const NUM_FMT_MAP: Record<string, string> = {
  general: 'General',
  number: '#,##0',
  decimal: '#,##0.00',
  currency: '"Rp"#,##0',
  percent: '0.00%',
  date: 'DD/MM/YYYY',
  text: '@',
}

export const xlsxGeneratorHandler: SkillHandler = async (
  args,
  ctx,
): Promise<SkillHandlerResult> => {
  const spec = validateXlsxSpec(args)
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'AI Skills'
  workbook.created = new Date()

  for (const sheetSpec of spec.sheets) {
    buildSheet(workbook, sheetSpec)
  }

  const fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer)
  const fileName = `${sanitizeFilename(spec.filename) || 'spreadsheet'}.xlsx`
  const previewMarkdown = xlsxSpecToMarkdown(spec)
  const previewTitle = sanitizeFilename(spec.filename) || spec.sheets[0]?.name || 'Spreadsheet'

  return {
    fileBuffer,
    fileName,
    mimeType: XLSX_MIME,
    previewMarkdown,
    previewTitle,
    llmFeedback: `Spreadsheet "${previewTitle}" berhasil dibuat (${fileName}, ${fileBuffer.byteLength} bytes, ${spec.sheets.length} sheet). Beri konfirmasi singkat 1 kalimat ke user dalam Bahasa Indonesia dan beri tahu mereka klik tombol Download di kartu. JANGAN ulangi isi spreadsheet.`,
  }
}

function buildSheet(workbook: ExcelJS.Workbook, sheetSpec: XlsxSheet): void {
  const sheet = workbook.addWorksheet(sheetSpec.name)

  // Set column definitions (header + width)
  sheet.columns = sheetSpec.columns.map((col) => ({
    header: col.header,
    width: col.width ?? 18,
  }))

  // Style the header row
  const headerRow = sheet.getRow(1)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, name: 'Arial', size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5E8F0' } }
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFAAAAAA' } },
    }
  })
  headerRow.height = 22

  // Add data rows
  for (const rowData of sheetSpec.rows) {
    const rowValues = rowData.map((cell) => {
      if (cell === null) return null
      if (typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean') {
        return cell
      }
      return cell.value
    })

    const addedRow = sheet.addRow(rowValues)

    // Apply per-cell formatting
    rowData.forEach((cell, colIdx) => {
      if (cell === null || typeof cell !== 'object') return
      const xlCell = addedRow.getCell(colIdx + 1)
      applyCellStyle(xlCell, cell)
    })

    addedRow.eachCell((cell) => {
      if (!cell.font) cell.font = { name: 'Arial', size: 10 }
      else cell.font = { name: 'Arial', size: 10, ...cell.font }
    })
  }

  // Freeze rows if requested
  if (sheetSpec.frozenRow) {
    sheet.views = [{ state: 'frozen', ySplit: sheetSpec.frozenRow }]
  } else {
    // Default: freeze header row
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
  }

  // Auto-filter on header row
  if (sheetSpec.columns.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheetSpec.columns.length },
    }
  }
}

function applyCellStyle(cell: ExcelJS.Cell, spec: XlsxCell): void {
  if (spec.bold || spec.italic || spec.color) {
    cell.font = {
      name: 'Arial',
      size: 10,
      bold: spec.bold,
      italic: spec.italic,
      color: spec.color ? { argb: `FF${spec.color}` } : undefined,
    }
  }
  if (spec.fill) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${spec.fill}` },
    }
  }
  if (spec.align) {
    cell.alignment = {
      ...cell.alignment,
      horizontal: spec.align,
      wrapText: spec.wrap,
    }
  }
  if (spec.numFmt) {
    cell.numFmt = NUM_FMT_MAP[spec.numFmt] ?? 'General'
  }
}
