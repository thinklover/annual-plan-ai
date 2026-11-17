// 員工名冊 Excel 匯入：基本資料＋指定年度的健檢日期與訓練時數。
import { download } from '../util'
import { pad2 } from './fmt'
import { emptyEmployeeYear, uid } from './store'
import { HOUR_KEYS, HOUR_LABELS, type Employee, type EvalData, type HourKey } from './types'

type BasicKey = 'name' | 'gender' | 'title' | 'cardRole' | 'hireDate' | 'leaveDate' | 'hireCheckDate' | 'cprExpiry'
  | 'dementiaCert' | 'disabilityCert' | 'footCare' | 'ba17'
type ColKey = BasicKey | 'healthCheck' | HourKey

interface ColDef { key: ColKey; label: string; date?: boolean; hours?: boolean; alias: string[]; sample: string; width?: number }

/** 範本欄位；alias 是其他常見寫法（比對時會先去掉空白與括號內的說明） */
const COLS: ColDef[] = [
  { key: 'name', label: '姓名', alias: ['員工姓名', '人員姓名'], sample: '王小明' },
  { key: 'gender', label: '性別', alias: [], sample: '女', width: 8 },
  { key: 'title', label: '職稱', alias: [], sample: '照顧服務員' },
  { key: 'cardRole', label: '長照小卡職別', alias: ['職別', '長照小卡', '小卡職別'], sample: '照顧服務人員' },
  { key: 'hireDate', label: '到職日', date: true, alias: ['到職日期'], sample: '113.06.01' },
  { key: 'leaveDate', label: '離職日', date: true, alias: ['離職日期'], sample: '' },
  { key: 'hireCheckDate', label: '到職體格檢查日期', date: true, alias: ['到職體檢日期', '體格檢查日期', '新進體檢日期'], sample: '113.05.20', width: 18 },
  { key: 'cprExpiry', label: 'CPR有效日期', date: true, alias: ['CPR到期日', 'CPR或CPCR或BLS訓練到期日', '到期日'], sample: '116.05.01' },
  { key: 'dementiaCert', label: '失智症基礎訓練證號', alias: ['失智症訓練課程', '失智症訓練證號'], sample: '', width: 20 },
  { key: 'disabilityCert', label: '身心障礙服務訓練證號', alias: ['身心障礙服務訓練', '身障訓練證號'], sample: '', width: 20 },
  { key: 'footCare', label: '足部照護課程證號', alias: ['足部照護課程'], sample: '', width: 18 },
  { key: 'ba17', label: 'BA17特殊課程證號', alias: ['BA17特殊課程', 'BA17'], sample: '', width: 18 },
  { key: 'healthCheck', label: '年度健康檢查日期', date: true, alias: ['年度健檢日期', '健康檢查日期', '在職體檢日期', '體檢日期'], sample: '115.03.15', width: 18 },
  ...HOUR_KEYS.map((k): ColDef => ({
    key: k, label: `${HOUR_LABELS[k]}時數`, hours: true, sample: '4', width: 14,
    alias: [HOUR_LABELS[k], ...(k === 'indigenous' ? ['原住民族文化敏感度及能力', '原住民族文化敏感度及能力時數'] : [])],
  })),
]

const norm = (s: string) => s.replace(/[（(][^）)]*[）)]/g, '').replace(/[\s　:：]/g, '').toUpperCase()
const HEADER_MAP = new Map<string, ColDef>()
for (const c of COLS) for (const n of [c.label, ...c.alias]) if (!HEADER_MAP.has(norm(n))) HEADER_MAP.set(norm(n), c)

/** Excel 儲存格 → 文字或日期 */
function cellValue(v: unknown): string | Date {
  if (v == null) return ''
  if (v instanceof Date) return v
  if (typeof v === 'object') {
    const o = v as { richText?: { text: string }[]; result?: unknown; text?: string }
    if (o.richText) return o.richText.map((r) => r.text).join('').trim()
    if ('result' in o) return cellValue(o.result)
    if (typeof o.text === 'string') return o.text.trim()
    return ''
  }
  return String(v).trim()
}

const iso = (y: number, m: number, d: number) => {
  const yy = y < 1911 ? y + 1911 : y
  const ok = m >= 1 && m <= 12 && d >= 1 && d <= new Date(yy, m, 0).getDate() && yy >= 1950 && yy <= 2100
  return ok ? `${yy}-${pad2(m)}-${pad2(d)}` : null
}

/** 接受 Excel 日期、114.07.30、114/7/30、2025-07-30、114年7月30日、1140730；無法辨識回傳 null */
export function parseDate(v: string | Date): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : iso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate())
  const s = v.trim()
  if (!s) return ''
  let m = /^(\d{2,4})\s*[./\-年]\s*(\d{1,2})\s*[./\-月]\s*(\d{1,2})\s*日?$/.exec(s)
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{3}|\d{4})(\d{2})(\d{2})$/.exec(s)
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]))
  // Excel 日期序號（把日期貼進文字格式的欄位時會變成 46508 這種數字）
  if (/^\d{5}(\.\d+)?$/.test(s)) return parseDate(new Date(Math.round((Number(s) - 25569) * 86400000)))
  return null
}

export interface ImportRow { values: Partial<Record<ColKey, string>> }
export interface ParseResult {
  rows: ImportRow[]
  /** 有對應到的欄位名稱 */
  matched: string[]
  /** 表頭有、但系統不認得的欄位 */
  unknown: string[]
  warnings: string[]
}

export async function parseStaffXlsx(file: File): Promise<ParseResult> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(await file.arrayBuffer())
  } catch {
    throw new Error('無法讀取這個檔案，請確認是 Excel 的 .xlsx 檔（舊版 .xls 請先另存成 .xlsx）。')
  }
  const text = (v: unknown) => {
    const c = cellValue(v)
    return c instanceof Date ? '' : c
  }
  for (const ws of wb.worksheets) {
    // 表頭列：前 10 列中有「姓名」欄的那一列（上方可以有機構名稱、標題）
    let headRow = 0
    for (let r = 1; r <= Math.min(10, ws.rowCount) && !headRow; r++) {
      for (let c = 1; c <= ws.columnCount; c++) if (HEADER_MAP.get(norm(text(ws.getCell(r, c).value)))?.key === 'name') headRow = r
    }
    if (!headRow) continue
    const colOf = new Map<number, ColDef>()
    const unknown: string[] = []
    const used = new Set<ColKey>()
    // 兩列表頭（例如「特殊訓練」底下才是課程名稱）：下一列對得上就用下一列
    const second = (c: number) => HEADER_MAP.get(norm(text(ws.getCell(headRow + 1, c).value)))
    let twoRows = false
    for (let c = 1; c <= ws.columnCount; c++) {
      const h = text(ws.getCell(headRow, c).value)
      let def = HEADER_MAP.get(norm(h))
      if (second(c) && (!def || second(c) !== def)) {
        def = second(c)
        twoRows = true
      }
      if (def && !used.has(def.key)) {
        colOf.set(c, def)
        used.add(def.key)
      } else if (h && !['序', '序號', '編號', '備註', '總計', '#'].includes(norm(h))) unknown.push(h)
    }
    const warnings: string[] = []
    const rows: ImportRow[] = []
    for (let r = headRow + (twoRows ? 2 : 1); r <= ws.rowCount; r++) {
      const values: Partial<Record<ColKey, string>> = {}
      for (const [c, def] of colOf) {
        const raw = cellValue(ws.getCell(r, c).value)
        if (def.date) {
          const d = parseDate(raw)
          if (d === null) warnings.push(`第 ${r} 列「${def.label}」的日期「${raw instanceof Date ? '' : raw}」無法辨識，已略過這一格。`)
          else if (d) values[def.key] = d
        } else if (raw instanceof Date) {
          continue
        } else if (def.hours) {
          const n = raw.replace(/[,，\s]|小時|hr?s?$/gi, '')
          if (n && !Number.isFinite(Number(n))) warnings.push(`第 ${r} 列「${def.label}」的「${raw}」不是數字，已略過這一格。`)
          else if (n) values[def.key] = n
        } else if (def.key === 'gender') {
          const g = /^(男|M|MALE)/i.test(raw) ? '男' : /^(女|F|FEMALE)/i.test(raw) ? '女' : ''
          if (raw && !g) warnings.push(`第 ${r} 列的性別「${raw}」無法辨識，已略過這一格。`)
          else if (g) values.gender = g
        } else if (raw) values[def.key] = raw
      }
      if (!values.name) {
        if (Object.keys(values).length) warnings.push(`第 ${r} 列沒有姓名，整列略過。`)
        continue
      }
      rows.push({ values })
    }
    return { rows, matched: [...colOf.values()].map((d) => d.label), unknown, warnings }
  }
  throw new Error('找不到「姓名」欄。請使用「下載匯入範本」的格式，或確認表頭列有「姓名」。')
}

export interface ApplyResult { added: string[]; updated: string[]; yearRows: number }

const YEAR_KEYS = new Set<ColKey>(['healthCheck', ...HOUR_KEYS])

/** 以姓名比對：名冊已有的人更新、沒有的人新增。空白的格子不會清掉原有資料。 */
export function applyStaffImport(d: EvalData, rows: ImportRow[], year: number): ApplyResult {
  const res: ApplyResult = { added: [], updated: [], yearRows: 0 }
  for (const { values } of rows) {
    const name = values.name!
    let e = d.employees.find((x) => x.name.trim() === name)
    if (!e) {
      e = {
        id: uid(), name, gender: '', title: '', cardRole: '', hireDate: '', leaveDate: '', hireCheckDate: '',
        dementiaCert: '', disabilityCert: '', footCare: '', ba17: '', cprExpiry: '', yearly: {},
      } satisfies Employee
      d.employees.push(e)
      res.added.push(name)
    } else if (!res.added.includes(name) && !res.updated.includes(name)) res.updated.push(name)
    delete e.draft
    let touchedYear = false
    for (const [k, v] of Object.entries(values) as [ColKey, string][]) {
      if (k === 'name') continue
      if (!YEAR_KEYS.has(k)) {
        ;(e[k as BasicKey] as string) = v
        continue
      }
      const y = (e.yearly[year] ??= emptyEmployeeYear())
      if (k === 'healthCheck') y.healthCheck = v
      else y.hours[k as HourKey] = v
      touchedYear = true
    }
    if (touchedYear) res.yearRows++
  }
  return res
}

/** 下載匯入範本：第一張是要填的表，第二張是填寫說明 */
export async function downloadStaffTemplate(yearText: string) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('員工名冊')
  const font = { name: '微軟正黑體', size: 12 }
  const thin = { style: 'thin' as const }
  const border = { top: thin, bottom: thin, left: thin, right: thin }
  COLS.forEach((c, i) => {
    const yearCol = YEAR_KEYS.has(c.key)
    Object.assign(ws.getCell(1, i + 1), {
      value: c.label, font: { ...font, bold: true }, border,
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: yearCol ? 'FFFDE9D9' : 'FFE2F0EC' } },
    })
    // 整欄設成文字格式，避免 Excel 把 113.06.01 改成數字
    ws.getColumn(i + 1).numFmt = '@'
    ws.getColumn(i + 1).width = c.width ?? 14
    Object.assign(ws.getCell(2, i + 1), { value: c.sample, font: { ...font, color: { argb: 'FF888888' } }, border })
  })
  ws.getRow(1).height = 36
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]

  const help = wb.addWorksheet('填寫說明')
  help.getColumn(1).width = 100
  ;[
    '員工名冊匯入範本 填寫說明',
    '',
    '1. 在「員工名冊」工作表從第 2 列開始填，一位員工一列。第 2 列的灰色文字是範例，請直接改掉或刪除。',
    '2. 只有「姓名」必填，其他欄位沒有資料可以留白；不需要的欄位可以整欄刪除，欄位順序也可以調整，但請不要改表頭文字。',
    '3. 日期可以填民國或西元：113.06.01、113/6/1、2024-06-01、113年6月1日 都可以。',
    '4. 性別填「男」或「女」。長照小卡職別請填「照顧服務人員」或「居督」，系統靠這一欄區分照服員與居督。',
    `5. 橘色表頭的欄位（年度健康檢查日期、各類訓練時數）是「年度資料」，會匯入到畫面上方選擇的年度（目前是 ${yearText}）。要匯入其他年度，請先在畫面上切換年度再匯入。`,
    '6. 訓練時數填該年度各類的總時數（小時），只填數字，例如 4 或 2.5；確定沒有時數請填 0。',
    '7. 匯入時以「姓名」比對：名冊已經有的人會更新資料，沒有的人會新增。留白的格子不會清掉系統裡原有的資料。',
    '8. 同名同姓的員工請在姓名後加註區別（例如 王小明A、王小明B），否則會被當成同一個人。',
  ].forEach((t, i) => {
    Object.assign(help.getCell(i + 1, 1), { value: t, font: i === 0 ? { ...font, size: 14, bold: true } : font, alignment: { wrapText: true, vertical: 'top' } })
  })

  const buf = await wb.xlsx.writeBuffer()
  download('員工名冊匯入範本.xlsx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
}
