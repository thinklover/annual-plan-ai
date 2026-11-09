import { download } from '../util'
import { safeName } from './exportDocx'

/** 欄位：可有下層欄位（兩列表頭，例如「特殊訓練」底下的各課程） */
export interface XCol {
  label: string
  width?: number
  children?: { label: string; width?: number }[]
}

export interface XSheet {
  org: string
  title: string
  cols: XCol[]
  rows: (string | number)[][]
  /** 表格下方右側的說明，例如「統計至114.06.30」 */
  note?: string
}

export async function exportXlsx(filename: string, sheet: XSheet) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheet.title.slice(0, 31))
  const leaf = sheet.cols.flatMap((c) => c.children ?? [c])
  const n = leaf.length
  const twoRows = sheet.cols.some((c) => c.children)
  const font = { name: '微軟正黑體', size: 12 }
  const thin = { style: 'thin' as const }
  const border = { top: thin, bottom: thin, left: thin, right: thin }

  let r = 1
  if (sheet.org) {
    ws.mergeCells(r, 1, r, n)
    Object.assign(ws.getCell(r, 1), { value: sheet.org, font, alignment: { horizontal: 'center' } })
    r++
  }
  ws.mergeCells(r, 1, r, n)
  Object.assign(ws.getCell(r, 1), { value: sheet.title, font: { ...font, size: 16, bold: true }, alignment: { horizontal: 'center' } })
  ws.getRow(r).height = 26
  r++

  const headTop = r
  let c = 1
  for (const col of sheet.cols) {
    if (col.children) {
      ws.mergeCells(r, c, r, c + col.children.length - 1)
      ws.getCell(r, c).value = col.label
      col.children.forEach((ch, i) => (ws.getCell(r + 1, c + i).value = ch.label))
      c += col.children.length
    } else {
      if (twoRows) ws.mergeCells(r, c, r + 1, c)
      ws.getCell(r, c).value = col.label
      c++
    }
  }
  r += twoRows ? 2 : 1
  for (let i = headTop; i < r; i++) {
    for (let j = 1; j <= n; j++) {
      Object.assign(ws.getCell(i, j), {
        font: { ...font, bold: true },
        border,
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } },
      })
    }
  }

  for (const row of sheet.rows) {
    row.forEach((v, j) => {
      Object.assign(ws.getCell(r, j + 1), { value: v, font, border, alignment: { vertical: 'top', wrapText: true } })
    })
    for (let j = row.length + 1; j <= n; j++) ws.getCell(r, j).border = border
    r++
  }

  if (sheet.note) {
    ws.mergeCells(r + 1, 1, r + 1, n)
    Object.assign(ws.getCell(r + 1, 1), { value: sheet.note, font, alignment: { horizontal: 'right' } })
  }
  leaf.forEach((col, i) => (ws.getColumn(i + 1).width = col.width ?? 14))
  ws.pageSetup = { orientation: n > 7 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }

  const buf = await wb.xlsx.writeBuffer()
  download(`${safeName(filename)}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
}
