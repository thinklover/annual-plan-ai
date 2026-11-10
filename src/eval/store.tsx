// 資料存取層：文字資料存 localStorage（照片另存 IndexedDB，見 photos.ts）。
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
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

/** 寫入瀏覽器；空間不足等原因失敗時回傳 false */
function saveData(d: EvalData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
    return true
  } catch {
    return false
  }
}

/** 員工改名時，同步更新所有紀錄裡的姓名 */
export function renameEverywhere(d: EvalData, from: string, to: string) {
  const r = (s: string) => (s === from ? to : s)
  for (const m of d.meetings) {
    m.chair = r(m.chair)
    m.recorder = r(m.recorder)
    m.attendees = [...new Set(m.attendees.map(r))]
  }
  for (const s of d.supervisions) {
    s.staff = r(s.staff)
    s.supervisor = r(s.supervisor)
  }
  for (const m of d.caseMeetings) {
    m.recorder = r(m.recorder)
    for (const p of m.professionals) p.name = r(p.name)
  }
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
  const [saveFailed, setSaveFailed] = useState(false)
  const latest = useRef(data)
  const commit = useCallback((next: EvalData) => {
    latest.current = next
    setData(next)
    setSaveFailed(!saveData(next))
  }, [])
  const update = useCallback((fn: (d: EvalData) => void) => {
    const next = structuredClone(latest.current)
    fn(next)
    commit(next)
  }, [commit])
  return (
    <StoreCtx.Provider value={{ data, update, replace: commit }}>
      {children}
      {saveFailed && (
        <div className="save-error" role="alert">
          儲存失敗：瀏覽器儲存空間可能已滿，剛才的修改尚未存檔。請先不要關閉或重新整理此頁，並把重要內容匯出成 Word／Excel。
        </div>
      )}
    </StoreCtx.Provider>
  )
}

export function useStore() {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('StoreProvider missing')
  return c
}

/** 進入列表時，清掉按了「新增」卻沒填任何內容的空白紀錄 */
export function usePruneDrafts() {
  const { update } = useStore()
  useEffect(() => {
    update((d) => {
      d.meetings = d.meetings.filter((x) => !x.draft)
      d.supervisions = d.supervisions.filter((x) => !x.draft)
      d.incidents = d.incidents.filter((x) => !x.draft)
      d.caseMeetings = d.caseMeetings.filter((x) => !x.draft)
    })
  }, [update])
}

/** 下拉選項＝預設＋自行增加 */
export function optionsOf(d: EvalData, key: string): string[] {
  return [...new Set([...(DEFAULT_OPTIONS[key] ?? []), ...(d.options[key] ?? [])])]
}
