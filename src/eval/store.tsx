// 資料存取層：文字資料存 localStorage（照片另存 IndexedDB，見 photos.ts）。
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type {
  AnnualPlan, CapacityMonth, EmployeeYear, EvalData, IncidentReport, Okr, PlanAction,
} from './types'

const KEY = 'home-eval:data'

export const uid = () => crypto.randomUUID()

export const DEFAULT_OPTIONS: Record<string, string[]> = {
  title: ['照顧服務員', '居家服務督導員', '業務負責人'],
  cardRole: ['照顧服務人員', '居督'],
  accidentType: ['交通事故', '照顧意外事件', '性騷擾/性侵害', '傳染病事件', '其他'],
  complaintType: ['意見反映', '申訴事件'],
  profCategory: ['護理', '社工', '個管人員', '居督員', '藥師', '照管專員', '職能治療師', '物理治療師'],
  place: [],
}

export function emptyData(): EvalData {
  return {
    version: 1,
    org: { name: '', address: '', foundedDate: '', vision: '', philosophy: '', mission: '', yearFormat: 'roc' },
    employees: [],
    capacity: {},
    plans: {},
    meetings: [],
    supervisions: [],
    incidents: [],
    reports: {},
    caseMeetings: [],
    options: {},
  }
}

export const emptyEmployeeYear = (): EmployeeYear => ({
  healthCheck: '',
  hours: { pro: '', quality: '', ethics: '', law: '', indigenous: '', multi: '' },
})

export const emptyCapacity = (): CapacityMonth[] =>
  Array.from({ length: 12 }, () => ({ cases: '', claimants: '', amount: '', override: {} }))

export const emptyAction = (): PlanAction => ({
  id: uid(), name: '', item: '', indicator: '', start: '', end: '', midResult: '', endResult: '',
})
export const emptyOkr = (): Okr => ({
  id: uid(), objective: '', actions: [emptyAction()], midProblem: '', midRevise: '', endProblem: '', endImprove: '',
})
export const emptyPlan = (): AnnualPlan => ({
  intro: '',
  swot: { s: '', w: '', o: '', t: '' },
  bsc: { financial: '', customer: '', process: '', learning: '' },
  okrs: [emptyOkr(), emptyOkr(), emptyOkr()],
})
export const emptyReport = (): IncidentReport => ({ summaries: {}, cause: '', improvement: '' })

/** 補齊缺少的欄位（舊資料或匯入資料） */
export function normalize(d: Partial<EvalData>): EvalData {
  const base = emptyData()
  return {
    ...base,
    ...d,
    org: { ...base.org, ...d.org },
    employees: (d.employees ?? []).map((e) => ({ ...e, yearly: e.yearly ?? {} })),
    options: { ...d.options },
  }
}

export function loadData(): EvalData {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? normalize(JSON.parse(raw)) : emptyData()
  } catch {
    return emptyData()
  }
}

function saveData(d: EvalData) {
  localStorage.setItem(KEY, JSON.stringify(d))
}

interface Ctx {
  data: EvalData
  /** 以 immer 風格修改：傳入的物件是深拷貝，可直接改 */
  update: (fn: (d: EvalData) => void) => void
  replace: (d: EvalData) => void
}

const StoreCtx = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(loadData)
  const update = useCallback((fn: (d: EvalData) => void) => {
    setData((prev) => {
      const next = structuredClone(prev)
      fn(next)
      saveData(next)
      return next
    })
  }, [])
  const replace = useCallback((d: EvalData) => {
    saveData(d)
    setData(d)
  }, [])
  return <StoreCtx.Provider value={{ data, update, replace }}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('StoreProvider missing')
  return c
}

/** 下拉選項＝預設＋自行增加 */
export function optionsOf(d: EvalData, key: string): string[] {
  return [...new Set([...(DEFAULT_OPTIONS[key] ?? []), ...(d.options[key] ?? [])])]
}
