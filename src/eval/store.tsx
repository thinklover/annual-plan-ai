// 資料狀態層：資料存在雲端資料庫（見 db.ts），登入後由 account.ts 讀進來。
// 修改先留在記憶體（草稿），按「提交」才寫入資料庫；未提交就離開頁面會捨棄。
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ConflictError, saveDocs, type DocChange } from './db'
import { deletePhoto } from './photos'
import type {
  AnnualPlan, CapacityMonth, EmployeeYear, EvalData, Improvement, IncidentReport, Okr, PlanAction,
} from './types'

/** 資料庫裡一個區塊存一列；提交時只寫有變動的區塊 */
export const SECTIONS = ['org', 'employees', 'capacity', 'plans', 'meetings', 'supervisions', 'incidents', 'reports', 'caseMeetings', 'options'] as const

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
  id: uid(), objective: '', krs: ['', ''], actions: [emptyAction()], midProblem: '', midRevise: '', endProblem: '', endImprove: '',
})
export const emptyPlan = (): AnnualPlan => ({
  intro: '',
  swot: { s: '', w: '', o: '', t: '' },
  bsc: { financial: '', customer: '', process: '', learning: '' },
  okrs: [emptyOkr(), emptyOkr(), emptyOkr()],
  endNarrative: '',
})
export const emptyImprovement = (): Improvement => ({ id: uid(), problem: '', measure: '' })
export const emptyReport = (): IncidentReport => ({ summaries: {}, cause: '', improvements: [emptyImprovement()] })

/** 補齊缺少的欄位（舊資料或匯入資料） */
export function normalize(d: Partial<EvalData>): EvalData {
  const base = emptyData()
  return {
    ...base,
    ...d,
    org: { ...base.org, ...d.org },
    employees: (d.employees ?? []).map((e) => ({ ...e, yearly: e.yearly ?? {} })),
    supervisions: (d.supervisions ?? []).map((x) => ({ ...x, photos: x.photos ?? [] })),
    incidents: (d.incidents ?? []).map((x) => ({ ...x, supervisorName: x.supervisorName ?? '', managerName: x.managerName ?? '' })),
    plans: Object.fromEntries(Object.entries(d.plans ?? {}).map(([y, p]) => [y, {
      ...p,
      endNarrative: p.endNarrative ?? '',
      okrs: p.okrs.map((o) => ({ ...o, krs: o.krs ?? ['', ''] })),
    }])),
    reports: Object.fromEntries(Object.entries(d.reports ?? {}).map(([k, r]) => {
      // 舊版單欄的改善措施放進第一列的「改善措施」
      const { improvement, ...rest } = r
      const rows = r.improvements ?? (improvement?.trim() ? [{ id: uid(), problem: '', measure: improvement }] : [emptyImprovement()])
      return [k, { ...rest, improvements: rows }]
    })),
    options: { ...d.options },
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

/** 資料裡用到的所有照片編號 */
function photoIds(d: EvalData): Set<string> {
  return new Set([...d.meetings, ...d.supervisions, ...d.caseMeetings].flatMap((x) => x.photos))
}
/** 刪掉 from 有、to 已經不用的照片檔 */
function dropPhotos(from: EvalData, to: EvalData) {
  const keep = photoIds(to)
  for (const id of photoIds(from)) if (!keep.has(id)) void deletePhoto(id).catch(() => {})
}

type Status = 'clean' | 'dirty' | 'saved'

interface Ctx {
  /** 畫面上的資料（含尚未提交的修改） */
  data: EvalData
  /** 有修改尚未提交 */
  dirty: boolean
  /** 剛提交成功，還沒再修改 */
  justSaved: boolean
  /** 以 immer 風格修改：傳入的物件是深拷貝，可直接改。只改畫面，按「提交」才存 */
  update: (fn: (d: EvalData) => void) => void
  /** 修改後立刻存檔（刪除整筆紀錄等已經再次確認過的動作）；存檔成功畫面才會跟著變 */
  updateNow: (fn: (d: EvalData) => void) => Promise<boolean>
  /** 把目前的修改寫入資料庫；失敗回傳 false */
  submit: () => Promise<boolean>
  /** 正在寫入資料庫 */
  saving: boolean
  /** 登入的帳號 */
  email: string
  /** 捨棄尚未提交的修改 */
  discard: () => void
  /** 程式切換頁面（不詢問未提交的修改） */
  go: (hash: string) => void
  /** 使用者要離開目前頁面：有未提交的修改就先詢問，回傳是否可以離開 */
  leave: () => boolean
}

const StoreCtx = createContext<Ctx | null>(null)

export function StoreProvider({ initial, versions, email, children }: {
  initial: EvalData
  versions: Record<string, number>
  email: string
  children: ReactNode
}) {
  const [data, setData] = useState(initial)
  const [status, setStatusState] = useState<Status>('clean')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<{ text: string; conflict: boolean } | null>(null)
  const latest = useRef(initial)
  const saved = useRef(initial)
  const vers = useRef(versions)
  const statusRef = useRef<Status>('clean')
  const skip = useRef(false)

  const setStatus = useCallback((s: Status) => {
    statusRef.current = s
    setStatusState(s)
  }, [])
  const persist = useCallback(async (next: EvalData) => {
    const base = latest.current
    const changes: Record<string, DocChange> = {}
    for (const k of SECTIONS) {
      if (JSON.stringify(next[k]) !== JSON.stringify(saved.current[k])) changes[k] = { version: vers.current[k] ?? 0, data: next[k] }
    }
    if (Object.keys(changes).length) {
      setSaving(true)
      try {
        vers.current = await saveDocs(changes)
      } catch (e) {
        setSaveError(e instanceof ConflictError
          ? { conflict: true, text: '提交失敗：這份資料剛才已被其他人（或另一個分頁）修改。請重新整理頁面取得最新資料後，再填一次這次的修改。' }
          : { conflict: false, text: `提交失敗，修改尚未存檔（${(e as Error).message}）。請確認網路連線後再按一次「提交」。` })
        return false
      } finally {
        setSaving(false)
      }
    }
    setSaveError(null)
    dropPhotos(saved.current, next)
    saved.current = next
    // 存檔期間又有新的修改：保留畫面上的內容，維持「尚未提交」
    if (latest.current === base) {
      latest.current = next
      setData(next)
      setStatus('saved')
    }
    return true
  }, [setStatus])
  const update = useCallback((fn: (d: EvalData) => void) => {
    const next = structuredClone(latest.current)
    fn(next)
    latest.current = next
    setData(next)
    setStatus('dirty')
  }, [setStatus])
  const updateNow = useCallback((fn: (d: EvalData) => void) => {
    const next = structuredClone(latest.current)
    fn(next)
    return persist(next)
  }, [persist])
  const submit = useCallback(() => persist(latest.current), [persist])
  const discard = useCallback(() => {
    dropPhotos(latest.current, saved.current)
    latest.current = saved.current
    setData(saved.current)
    setSaveError(null)
    setStatus('clean')
  }, [setStatus])
  const go = useCallback((hash: string) => {
    if (location.hash === hash) return
    skip.current = true
    location.hash = hash
  }, [])
  const leave = useCallback(() => {
    if (skip.current) {
      skip.current = false
      return true
    }
    if (statusRef.current === 'dirty') {
      if (!window.confirm('這一頁有修改尚未提交，離開會捨棄這些修改。\n\n確定離開嗎？（要保留請按「取消」，再按「提交」）')) {
        skip.current = true
        return false
      }
      discard()
    } else if (statusRef.current === 'saved') {
      setStatus('clean')
    }
    return true
  }, [discard, setStatus])

  const dirty = status === 'dirty'
  // 關閉分頁或重新整理前提醒
  useEffect(() => {
    if (!dirty) return
    const on = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', on)
    return () => window.removeEventListener('beforeunload', on)
  }, [dirty])

  return (
    <StoreCtx.Provider value={{ data, dirty, justSaved: status === 'saved', saving, email, update, updateNow, submit, discard, go, leave }}>
      {children}
      {saveError && (
        <div className="save-error" role="alert">
          {saveError.text}
          {saveError.conflict && <button type="button" className="btn small" onClick={() => location.reload()}>重新整理</button>}
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
  const { updateNow } = useStore()
  useEffect(() => {
    updateNow((d) => {
      d.meetings = d.meetings.filter((x) => !x.draft)
      d.supervisions = d.supervisions.filter((x) => !x.draft)
      d.incidents = d.incidents.filter((x) => !x.draft)
      d.caseMeetings = d.caseMeetings.filter((x) => !x.draft)
    })
  }, [updateNow])
}

/** 下拉選項＝預設＋自行增加 */
export function optionsOf(d: EvalData, key: string): string[] {
  return [...new Set([...(DEFAULT_OPTIONS[key] ?? []), ...(d.options[key] ?? [])])]
}
