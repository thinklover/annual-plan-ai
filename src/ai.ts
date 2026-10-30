/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AiField, BlockDef } from './blocks'
import { ROW_FACTORY } from './defaults'
import { generate, parseJson } from './gemini'
import type { Plan, Settings } from './types'
import { getPath, isBlank, setPath } from './util'

interface AiResult {
  values: Record<string, unknown>
  evidence?: Record<string, string>
}

const SYSTEM = [
  '你是台灣長期照顧服務機構（日間照顧為主）的年度業務計畫書撰寫助理，熟悉衛福部長照機構評鑑基準。',
  '一律使用繁體中文與台灣用語，文字精簡、正式，適合送評鑑的計畫書。',
  '只回傳 JSON，不要任何說明文字。',
].join('\n')

function describe(f: AiField, plan: Plan): string {
  const hint = f.hint ? `（${f.hint}）` : ''
  switch (f.kind) {
    case 'text':
      return f.bullets
        ? `"${f.key}"：${f.label}${hint}。字串；條列，每項一行，以「1. 」「2. 」編號。`
        : `"${f.key}"：${f.label}${hint}。字串，不要加編號。`
    case 'list':
      return `"${f.key}"：${f.label}${hint}。字串陣列。`
    case 'table':
    case 'merge': {
      const cols = f.cols!
        .map((c) => `"${c.key}"（${c.label}${c.type === 'months' ? '，1～12 的整數陣列' : c.type === 'number' ? '，只填阿拉伯數字，不加逗號與單位' : c.type === 'textarea' ? '，字串，改寫成正式書面語' : '，字串'}）`)
        .join('、')
      let s = `"${f.key}"：${f.label}。物件陣列，每個物件的欄位：${cols}。`
      if (f.kind === 'merge') {
        const existing = (getPath(plan, f.path) as any[]).map((r) => r[f.matchKey!]).filter(Boolean)
        s += `請以 "${f.matchKey}" 對應計畫中既有的項目：${existing.length ? existing.join('、') : '（目前沒有）'}；`
        s += '名稱請與既有項目完全一致，逐字稿有提到但不在清單中的項目也可以列出。'
      }
      return s
    }
  }
}

export async function runBlockAi(
  settings: Settings, plan: Plan, block: BlockDef, transcript: string,
): Promise<AiResult> {
  const fields = block.fields
  if (!fields.length) return { values: {} }
  const year = plan.basic.planYear || '（未定）'
  const header = [
    `機構名稱：${plan.basic.orgName || '（未定）'}；計畫年度：民國 ${year} 年；前一年度：民國 ${Number(year) - 1 || '（未定）'} 年。`,
    `目前要填寫的區塊：${block.no}、${block.title}——${block.desc}`,
    ...(block.aiGuide ? [`本區注意事項：${block.aiGuide}`] : []),
    '',
    '要輸出的欄位：',
    ...fields.map((f) => '- ' + describe(f, plan)),
    '',
  ]
  const rules = [
    '規則：',
    '1. 只能根據下方逐字稿中「受訪者」實際說出的內容填寫；訪談員的提問不是答案。',
    '2. 逐字稿沒有提到的欄位，請回傳空字串 "" 或空陣列 []，絕對不要推測或編造，尤其是人數、金額、百分比與日期。',
    '3. 文字一律改寫為正式書面語：以「本機構」取代「我們」，刪除「大概、就是、然後、那個」等口語；數字與事實不可更動，也不可加入逐字稿沒有的內容。',
    '4. 逐字稿中的「今年」「明年」「去年」請依計畫年度換算；若逐字稿明確說出計畫年度，以逐字稿為準。',
    '5. 項目名稱以受訪者的說法為準：口語簡稱要補成完整的正式名稱（例如「日照」→「日間照顧服務」、「餐」→「餐飲服務」、「失能」→「失能長者」），但不要換成意思不同的詞（例如「在職訓練」不要改成「教育訓練」）。',
    '6. 每個有填寫的欄位，在 evidence 中附上最能支持它的逐字稿原句（100 字以內）。',
    '',
    '回傳格式：{"values": {欄位key: 值, ...}, "evidence": {欄位key: "逐字稿原句", ...}}',
    '',
    '逐字稿：',
    '"""',
    transcript,
    '"""',
  ]
  const text = await generate(settings, SYSTEM, [...header, ...rules].join('\n'))
  const result = parseJson<AiResult>(text)
  if (!result || typeof result.values !== 'object') throw new Error('AI 回傳格式不正確')
  return result
}

/* ---------- 套用 AI 結果 ---------- */

function resultCols(f: AiField) {
  return f.cols!.filter((c) => c.key !== f.matchKey)
}

function isFieldBlank(plan: Plan, f: AiField) {
  const v = getPath(plan, f.path)
  if (f.kind === 'merge') {
    const cols = resultCols(f)
    return (v as any[]).every((r) => cols.every((c) => isBlank(r[c.key])))
  }
  return isBlank(v)
}

function cleanCell(v: unknown, type?: string) {
  if (type === 'months') {
    return Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 12))].sort((a, b) => a - b) : []
  }
  if (v == null) return ''
  return Array.isArray(v) ? v.join('\n') : String(v)
}

function toRows(f: AiField, v: unknown) {
  if (!Array.isArray(v)) return []
  return v
    .filter((r) => r && typeof r === 'object')
    .map((r: any) => {
      const row: Record<string, unknown> = {}
      for (const c of f.cols!) row[c.key] = cleanCell(r[c.key], c.type)
      return ROW_FACTORY[f.path](row)
    })
    .filter((r) => !isBlank(r))
}

/** 把 AI 結果直接寫進計畫書；人工填寫過的欄位不覆蓋。回傳新計畫書與寫入欄位數。 */
export function applyAi(plan: Plan, block: BlockDef, result: AiResult): { plan: Plan; written: number } {
  const next: Plan = structuredClone(plan)
  let written = 0
  for (const f of block.fields) {
    const raw = result.values[f.key]
    if (raw === undefined || isBlank(raw)) continue
    const meta = next.meta[f.key]
    const blank = isFieldBlank(next, f)
    const replaceable = meta && meta.source !== 'manual'
    const writable = blank || replaceable
    if (!writable) continue

    if (f.kind === 'text') {
      let text = cleanCell(raw) as string
      // 單行欄位去掉模型多加的「1. 」
      if (!f.bullets && !text.includes('\n')) text = text.replace(/^\s*1[.、．]\s*/, '')
      setPath(next, f.path, text)
    } else if (f.kind === 'list') {
      setPath(next, f.path, Array.isArray(raw) ? raw.map(String).filter((s) => s.trim()) : [String(raw)])
    } else if (f.kind === 'table') {
      const rows = toRows(f, raw)
      if (!rows.length) continue
      setPath(next, f.path, rows)
    } else {
      const rows = getPath(next, f.path) as any[]
      // 先前也是 AI 填的：清掉舊結果再重填，避免舊的錯誤數字殘留
      if (!blank) for (const x of rows) for (const c of resultCols(f)) x[c.key] = ''
      const norm = (s: unknown) => String(s ?? '').replace(/\s/g, '')
      for (const r of toRows(f, raw) as any[]) {
        const hit = rows.find((x) => norm(x[f.matchKey!]) === norm(r[f.matchKey!]))
        if (hit) {
          for (const c of resultCols(f)) if (!isBlank(r[c.key])) hit[c.key] = r[c.key]
        } else {
          rows.push(r)
        }
      }
    }
    next.meta[f.key] = { source: 'transcript', evidence: result.evidence?.[f.key] }
    written++
  }
  next.updatedAt = new Date().toISOString()
  return { plan: next, written }
}

/* ---------- 文字修飾 ---------- */

export const POLISH_MODES = {
  formal: '改寫得更正式、通順，適合正式計畫書。',
  concise: '精簡文字，保留重點，刪除贅字。',
  evaluation: '改寫成符合長照機構評鑑委員閱讀習慣的用語：目標具體可衡量、呼應評鑑基準、條列清楚。',
} as const

export type PolishMode = keyof typeof POLISH_MODES | 'custom'

export async function polishText(settings: Settings, text: string, label: string, mode: PolishMode, custom = '') {
  const instruction = mode === 'custom' ? custom : POLISH_MODES[mode]
  const prompt = [
    `以下是年度業務計畫書「${label}」欄位的內容。`,
    `請依此指示修改：${instruction}`,
    '不可新增原文沒有的事實或數字；保留原有的條列編號格式。只輸出修改後的文字，不要任何說明。',
    '',
    '原文：',
    text,
  ].join('\n')
  return (await generate(settings, SYSTEM.replace('只回傳 JSON，不要任何說明文字。', ''), prompt, false)).trim()
}
