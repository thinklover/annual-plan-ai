// 日期、年份格式與人員統計
import type { CapacityMonth, Employee, EvalData, StaffCountKey, YearFormat } from './types'

export const thisYear = () => new Date().getFullYear()

/** 年度顯示：民國 114／西元 2025 */
export const yearLabel = (y: number, f: YearFormat) => String(f === 'roc' ? y - 1911 : y)

/** 2025-07-30 → 114.07.30 或 2025.07.30 */
export function fmtDate(iso: string, f: YearFormat): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  if (!m) return ''
  return `${yearLabel(Number(m[1]), f)}.${m[2]}.${m[3]}`
}

/** 2025-03-10 → 3/10 */
export function fmtMD(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? `${Number(m[1])}/${Number(m[2])}` : ''
}

export const yearOf = (iso: string) => Number((iso || '').slice(0, 4)) || 0
export const inYear = (iso: string, y: number) => yearOf(iso) === y
export const byDate = <T extends { date: string; time?: string }>(a: T, b: T) =>
  (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? ''))
export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const pad2 = (n: number) => String(n).padStart(2, '0')
const monthEnd = (y: number, m: number) => `${y}-${pad2(m)}-${pad2(new Date(y, m, 0).getDate())}`

// ---------- 人員分類 ----------
export const isSupervisor = (e: Employee) => /督/.test(e.cardRole) || /督導/.test(e.title)
export const isCaregiver = (e: Employee) => !isSupervisor(e) && (/照顧服務/.test(e.cardRole) || /照顧服務/.test(e.title))

export const activeOn = (e: Employee, iso: string) =>
  !!e.hireDate && e.hireDate <= iso && (!e.leaveDate || e.leaveDate > iso)

/** 該年度任何時間在職 */
export const activeInYear = (e: Employee, y: number) =>
  !!e.hireDate && e.hireDate <= `${y}-12-31` && (!e.leaveDate || e.leaveDate >= `${y}-01-01`)

/** 每月自動計算的人力數 */
export function autoStaffCounts(emps: Employee[], y: number, m: number): Record<StaffCountKey, number> {
  const end = monthEnd(y, m)
  const ym = `${y}-${pad2(m)}`
  const sup = emps.filter(isSupervisor)
  const cg = emps.filter(isCaregiver)
  const act = (list: Employee[], g: string) => list.filter((e) => activeOn(e, end) && e.gender === g).length
  return {
    supM: act(sup, '男'),
    supF: act(sup, '女'),
    cgM: act(cg, '男'),
    cgF: act(cg, '女'),
    supNew: sup.filter((e) => e.hireDate.startsWith(ym)).length,
    supLeave: sup.filter((e) => e.leaveDate.startsWith(ym)).length,
    cgNew: cg.filter((e) => e.hireDate.startsWith(ym)).length,
    cgLeave: cg.filter((e) => e.leaveDate.startsWith(ym)).length,
  }
}

export const toNum = (s: string) => {
  const n = Number(String(s ?? '').replace(/[,，\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** 每月服務量能（含人數；手動覆寫優先） */
export function capacityRows(d: EvalData, y: number) {
  const months: CapacityMonth[] = d.capacity[y] ?? []
  return Array.from({ length: 12 }, (_, i) => {
    const src = months[i] ?? { cases: '', claimants: '', amount: '', override: {} }
    const auto = autoStaffCounts(d.employees, y, i + 1)
    const staff = Object.fromEntries(
      Object.entries(auto).map(([k, v]) => {
        const o = src.override?.[k as StaffCountKey]
        return [k, o != null && o !== '' ? toNum(o) : v]
      }),
    ) as Record<StaffCountKey, number>
    return { month: i + 1, cases: src.cases, claimants: src.claimants, amount: src.amount, auto, staff }
  })
}

export const hasValue = (s: string) => String(s ?? '').trim() !== ''

/** 總計與平均（空白不列入平均） */
export function sumAvg(values: string[]) {
  const nums = values.filter(hasValue).map(toNum)
  const sum = nums.reduce((a, b) => a + b, 0)
  return { sum, avg: nums.length ? sum / nums.length : 0, n: nums.length }
}

export const fmtNum = (n: number, digits = 0) =>
  n.toLocaleString('zh-TW', { maximumFractionDigits: digits, minimumFractionDigits: 0 })

export const pct = (a: number, total: number) => (total ? `${((a / total) * 100).toFixed(2)}%` : '0%')
