/** default：系統預設值，可被 AI 覆蓋、不需確認 */
export type Source = 'transcript' | 'ai_guess' | 'manual' | 'default'

export interface FieldMeta {
  source: Source
  confirmed: boolean
  evidence?: string
}

export interface NamedItem {
  id: string
  name: string
  enabled: boolean
}

export interface Role {
  id: string
  name: string
  parent: string
  enabled: boolean
}

export interface StaffRow {
  id: string
  title: string
  prevCount: string
  planCount: string
  duty: string
  actualCount: string
}

export interface PlanItem {
  id: string
  name: string
  desc: string
  months: number[]
  result: string
  participants: string
  rate: string
  improvement: string
}

export interface ContentRow {
  id: string
  item: string
  content: string
}

export interface TargetRow {
  id: string
  item: string
  prevCount: string
  target: string
  actual: string
}

export interface FeeRow {
  id: string
  item: string
  amount: string
  unit: string
  note: string
}

export interface CashRow {
  id: string
  item: string
  content: string
  monthly: string
}

export interface CalRow {
  id: string
  category: string
  name: string
  months: number[]
  note: string
}

export type Perspective = 'finance' | 'customer' | 'process' | 'learning'

export interface SoCell {
  s: string
  o: string
  goal: string
}

export interface Plan {
  id: string
  createdAt: string
  updatedAt: string
  submitted: boolean
  basic: {
    orgName: string
    planYear: string
    title: string
    madeYear: string
    madeMonth: string
    serviceType: string
    city: string
    district: string
    address: string
    approvalDate: string
    openDate: string
    versionDate: string
  }
  basis: string
  vision: { vision: string; mission: string; coreValues: string[] }
  so: Record<Perspective, SoCell> & { note: string }
  okr: { o: string; q1: string; q2: string; q3: string; q4: string }
  services: NamedItem[]
  targets: NamedItem[]
  roles: Role[]
  staffing: StaffRow[]
  serviceContent: ContentRow[]
  satisfaction: { year: string; analysis: string; issues: string; improvement: string; strategy: string }
  operations: PlanItem[]
  activities: PlanItem[]
  serviceTargets: TargetRow[]
  calendarManual: CalRow[]
  fees: FeeRow[]
  pettyCash: CashRow[]
  transcripts: { plan: string; review: string }
  scriptChecks: Record<string, boolean>
  meta: Record<string, FieldMeta>
}

export interface Settings {
  apiKey: string
  model: string
}
