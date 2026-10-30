// 資料存取層：第一版存在瀏覽器 localStorage，日後改接 MySQL 只需替換本檔。
import { emptyPlan } from './defaults'
import type { Plan, Settings } from './types'

const PLANS_KEY = 'annual-plan-ai:plans'
const SETTINGS_KEY = 'annual-plan-ai:settings'
export const DEFAULT_MODEL = 'gemini-3.8-flash'

function readAll(): Record<string, Plan> {
  try {
    return JSON.parse(localStorage.getItem(PLANS_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeAll(all: Record<string, Plan>) {
  localStorage.setItem(PLANS_KEY, JSON.stringify(all))
}

/** 補齊舊版或匯入資料缺少的欄位 */
function normalize(p: Partial<Plan>): Plan {
  const base = emptyPlan()
  return {
    ...base,
    ...p,
    basic: { ...base.basic, ...p.basic },
    vision: { ...base.vision, ...p.vision },
    so: { ...base.so, ...p.so },
    okr: { ...base.okr, ...p.okr },
    satisfaction: { ...base.satisfaction, ...p.satisfaction },
    transcripts: { ...base.transcripts, ...p.transcripts },
  } as Plan
}

export function listPlans(): Plan[] {
  return Object.values(readAll())
    .map(normalize)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getPlan(id: string): Plan | undefined {
  const p = readAll()[id]
  return p ? normalize(p) : undefined
}

export function savePlan(plan: Plan) {
  const all = readAll()
  all[plan.id] = plan
  writeAll(all)
}

export function deletePlan(id: string) {
  const all = readAll()
  delete all[id]
  writeAll(all)
}

export function importPlan(json: string): Plan {
  const data = JSON.parse(json) as Partial<Plan>
  if (!data || typeof data !== 'object' || !data.basic) throw new Error('不是有效的計畫書 JSON 檔')
  const plan = normalize(data)
  if (getPlan(plan.id)) plan.id = crypto.randomUUID()
  savePlan(plan)
  return plan
}

export function getSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    return { apiKey: s.apiKey || '', model: s.model || DEFAULT_MODEL }
  } catch {
    return { apiKey: '', model: DEFAULT_MODEL }
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}
