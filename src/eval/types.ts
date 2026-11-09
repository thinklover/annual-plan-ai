// 居家評鑑資料系統的資料型別。日期一律存 ISO（YYYY-MM-DD），年度存西元年。

export type YearFormat = 'roc' | 'ad'

export interface Org {
  name: string
  address: string
  foundedDate: string
  vision: string
  philosophy: string
  mission: string
  yearFormat: YearFormat
}

export const HOUR_KEYS = ['pro', 'quality', 'ethics', 'law', 'indigenous', 'multi'] as const
export type HourKey = (typeof HOUR_KEYS)[number]
export const HOUR_LABELS: Record<HourKey, string> = {
  pro: '專業課程',
  quality: '專業品質',
  ethics: '專業倫理',
  law: '專業法規',
  indigenous: '原住民族文化',
  multi: '多元族群文化敏感度及能力',
}

export interface EmployeeYear {
  healthCheck: string
  hours: Record<HourKey, string>
}

export interface Employee {
  id: string
  name: string
  gender: '' | '男' | '女'
  title: string
  /** 長照小卡職別：照顧服務人員／居督…，用來分類居督與照服員 */
  cardRole: string
  hireDate: string
  leaveDate: string
  hireCheckDate: string
  dementiaCert: string
  disabilityCert: string
  footCare: string
  ba17: string
  cprExpiry: string
  yearly: Record<string, EmployeeYear>
}

export interface CapacityMonth {
  cases: string
  claimants: string
  amount: string
  /** 手動覆寫自動計算的人數；空字串代表用自動值 */
  override: Partial<Record<StaffCountKey, string>>
}
export type StaffCountKey = 'supM' | 'supF' | 'cgM' | 'cgF' | 'supNew' | 'supLeave' | 'cgNew' | 'cgLeave'

export interface Topic { id: string; title: string; discussion: string; resolution: string }

export type MeetingKind = 'admin' | 'group'
export interface Meeting {
  id: string
  kind: MeetingKind
  date: string
  time: string
  place: string
  chair: string
  recorder: string
  attendees: string[]
  target: string
  prevFollow: string
  topics: Topic[]
  nextFollow: string
  photos: string[]
}

export interface Supervision {
  id: string
  date: string
  staff: string
  problem: string
  feedback: string
  plan: string
  supervisor: string
}

export type IncidentKind = 'accident' | 'complaint'
export interface Incident {
  id: string
  kind: IncidentKind
  date: string
  type: string
  reporter: string
  description: string
  response: string
  followup: string
  supervisorNote: string
  managerNote: string
}
export interface IncidentReport {
  /** 3-1 類型統計表的「主要內容簡述」，依類型 */
  summaries: Record<string, string>
  cause: string
  improvement: string
}

export interface Professional { id: string; name: string; category: string }
export interface CaseMeeting {
  id: string
  date: string
  time: string
  place: string
  recorder: string
  professionals: Professional[]
  summary: string
  issues: string
  suggestions: string
  followup: string
  photos: string[]
}

export interface PlanAction {
  id: string
  name: string
  item: string
  indicator: string
  start: string
  end: string
  midResult: string
  endResult: string
}
export interface Okr {
  id: string
  objective: string
  actions: PlanAction[]
  midProblem: string
  midRevise: string
  endProblem: string
  endImprove: string
}
export interface AnnualPlan {
  intro: string
  swot: { s: string; w: string; o: string; t: string }
  bsc: { financial: string; customer: string; process: string; learning: string }
  okrs: Okr[]
}

export interface EvalData {
  version: 1
  org: Org
  employees: Employee[]
  capacity: Record<string, CapacityMonth[]>
  plans: Record<string, AnnualPlan>
  meetings: Meeting[]
  supervisions: Supervision[]
  incidents: Incident[]
  reports: Record<string, IncidentReport>
  caseMeetings: CaseMeeting[]
  /** 自行增加的下拉選項 */
  options: Record<string, string[]>
}
