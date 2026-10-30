import type {
  CalRow, CashRow, ContentRow, FeeRow, NamedItem, Perspective, Plan, PlanItem, Role, StaffRow, TargetRow,
} from './types'

export const uid = () => crypto.randomUUID()

export const PERSPECTIVES: { key: Perspective; label: string; hint: string }[] = [
  { key: 'finance', label: '財務面', hint: '收托人數、營收、成本、福利待遇等' },
  { key: 'customer', label: '顧客面', hint: '服務品質、活動規劃、照顧技巧、家屬關係等' },
  { key: 'process', label: '內部流程', hint: '行政程序、溝通窗口、資訊化等' },
  { key: 'learning', label: '學習成長', hint: '職能培訓、專長培訓、幹部培育等' },
]

export const newNamed = (name = ''): NamedItem => ({ id: uid(), name, enabled: true })
export const newRole = (name = '', parent = ''): Role => ({ id: uid(), name, parent, enabled: true })
export const newStaff = (p: Partial<StaffRow> = {}): StaffRow => ({
  id: uid(), title: '', prevCount: '', planCount: '', duty: '', actualCount: '', ...p,
})
export const newPlanItem = (p: Partial<PlanItem> = {}): PlanItem => ({
  id: uid(), name: '', desc: '', months: [], result: '', participants: '', rate: '', improvement: '', ...p,
})
export const newContent = (p: Partial<ContentRow> = {}): ContentRow => ({ id: uid(), item: '', content: '', ...p })
export const newTarget = (p: Partial<TargetRow> = {}): TargetRow => ({
  id: uid(), item: '', prevCount: '', target: '', actual: '', ...p,
})
export const newFee = (p: Partial<FeeRow> = {}): FeeRow => ({ id: uid(), item: '', amount: '', unit: '', note: '', ...p })
export const newCash = (p: Partial<CashRow> = {}): CashRow => ({ id: uid(), item: '', content: '', monthly: '', ...p })
export const newCal = (p: Partial<CalRow> = {}): CalRow => ({ id: uid(), category: '其他', name: '', months: [], note: '', ...p })

/** 依資料路徑產生空白列，供表格新增與 AI 回填使用 */
export const ROW_FACTORY: Record<string, (p?: Record<string, unknown>) => { id: string }> = {
  services: (p) => ({ ...newNamed(), ...p }),
  targets: (p) => ({ ...newNamed(), ...p }),
  roles: (p) => ({ ...newRole(), ...p }),
  staffing: (p) => newStaff(p as Partial<StaffRow>),
  serviceContent: (p) => newContent(p as Partial<ContentRow>),
  operations: (p) => newPlanItem(p as Partial<PlanItem>),
  activities: (p) => newPlanItem(p as Partial<PlanItem>),
  serviceTargets: (p) => newTarget(p as Partial<TargetRow>),
  calendarManual: (p) => newCal(p as Partial<CalRow>),
  fees: (p) => newFee(p as Partial<FeeRow>),
  pettyCash: (p) => newCash(p as Partial<CashRow>),
}

export const DEFAULT_BASIS =
  '依據衛生福利部「長期照顧服務機構評鑑基準」A1 業務計畫擬定與執行：機構應依服務對象需求研擬年度業務計畫，' +
  '訂定計畫目標，並留有執行紀錄及檢討改善。'

const rocNow = () => {
  const d = new Date()
  return { year: String(d.getFullYear() - 1911), month: String(d.getMonth() + 1) }
}

export function makeTitle(plan: Plan) {
  const y = plan.basic.planYear || '○○○'
  return `${plan.basic.orgName || '○○機構'} ${y} 年度業務計畫書`
}

export function emptyPlan(): Plan {
  const now = new Date().toISOString()
  const roc = rocNow()
  const blank = { s: '', o: '', goal: '' }
  return {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    submitted: false,
    basic: {
      orgName: '', planYear: String(Number(roc.year) + 1), title: '', madeYear: roc.year, madeMonth: roc.month,
      serviceType: '', city: '', district: '', address: '', approvalDate: '', openDate: '', versionDate: '',
    },
    basis: DEFAULT_BASIS,
    vision: { vision: '', mission: '', coreValues: [''] },
    so: { finance: { ...blank }, customer: { ...blank }, process: { ...blank }, learning: { ...blank }, note: '' },
    okr: { o: '', q1: '', q2: '', q3: '', q4: '' },
    services: [],
    targets: [],
    roles: [],
    staffing: [],
    serviceContent: [],
    satisfaction: { year: String(Number(roc.year)), analysis: '', issues: '', improvement: '', strategy: '' },
    operations: [],
    activities: [],
    serviceTargets: [],
    calendarManual: [],
    fees: [],
    pettyCash: [],
    transcripts: { plan: '', review: '' },
    scriptChecks: {},
    meta: {
      'basic.planYear': { source: 'default', confirmed: true },
      'basic.madeYear': { source: 'default', confirmed: true },
      'basic.madeMonth': { source: 'default', confirmed: true },
      'satisfaction.year': { source: 'default', confirmed: true },
    },
  }
}

/* ---------- 範本（本系統自行撰寫） ---------- */

export const TPL_VISION = {
  vision: '讓長者在熟悉的社區中，有尊嚴、有朋友、有笑容地安老。',
  mission: '以專業團隊提供以人為本的日間照顧，維持長者自主能力，並支持家庭照顧者。',
  coreValues: ['尊重自主', '專業負責', '團隊合作', '社區共好'],
}

export const TPL_SERVICES = [
  '日間照顧服務', '交通接送服務', '餐飲服務', '健康促進與延緩失能活動', '家庭照顧者支持服務', '臨時住宿／喘息服務',
]

export const TPL_TARGETS = ['失能長者', '失智症者', '衰弱長者', '身心障礙者', '其他經評估有需要者']

export const TPL_ROLES: [string, string][] = [
  ['機構主任', ''], ['社工人員', '機構主任'], ['護理人員', '機構主任'], ['照顧服務員', '護理人員'],
  ['司機', '社工人員'], ['行政人員', '機構主任'],
]

export const TPL_SERVICE_CONTENT: [string, string][] = [
  ['個案評估與照顧計畫', '入托時由跨專業團隊進行身心功能評估，訂定個別照顧計畫，並定期複評。'],
  ['生活照顧', '協助如廁、進食、移位、盥洗等日常生活活動，依能力引導長者自己完成。'],
  ['健康管理', '每日量測生命徵象，協助服藥管理，異常時通知家屬並轉介就醫。'],
  ['延緩失能活動', '安排肌力、認知、手作、團體等課程，維持身體與認知功能。'],
  ['餐飲服務', '提供午餐及點心，依咀嚼吞嚥能力調整餐食質地。'],
  ['交通接送', '提供居家至機構往返接送，確保上下車安全。'],
  ['家屬支持', '定期聯繫家屬說明長者狀況，辦理家屬座談與照顧技巧分享。'],
]

export const TPL_OPERATIONS: [string, string, number[]][] = [
  ['團隊督導會議', '每月召開督導會議，追蹤年度目標與關鍵結果進度。', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
  ['在職教育訓練', '依規定辦理員工在職訓練，並追蹤訓練時數。', [3, 6, 9, 12]],
  ['個案複評', '定期辦理個案複評並更新照顧計畫。', [6, 12]],
  ['感染管制查核', '辦理手部衛生稽核與環境清潔查核。', [1, 4, 7, 10]],
  ['意外事件檢討', '跌倒、噎食等事件通報、分析與改善追蹤。', [6, 12]],
  ['消防安全檢查與申報', '依法辦理消防設備檢修申報。', [5]],
  ['緊急災害應變演練', '辦理火災、地震疏散演練。', [4, 10]],
  ['飲用水與環境消毒', '飲水機水質檢驗、水塔清洗及環境消毒。', [3, 9]],
  ['滿意度調查', '辦理服務對象及家屬滿意度調查並分析改善。', [11]],
]

export const TPL_ACTIVITIES: [string, string, number[]][] = [
  ['懷舊音樂活動', '以老歌帶動回憶分享，促進表達與情緒交流。', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
  ['肌力與平衡運動', '每週團體運動課程，降低跌倒風險。', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
  ['手作與藝術課程', '透過手作訓練手部精細動作與專注力。', [2, 4, 6, 8, 10, 12]],
  ['園藝療癒', '照顧植栽，提供感官刺激與成就感。', [3, 4, 5, 9, 10, 11]],
  ['節慶活動', '配合春節、端午、中秋等節日辦理應景活動。', [1, 6, 9]],
  ['社區參訪', '安排戶外踏青或社區據點參訪。', [4, 10]],
  ['慶生會', '每月為當月壽星辦理慶生。', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
]

export const TPL_SERVICE_TARGETS = ['日間照顧服務', '交通接送服務', '家庭照顧者支持服務', '社區宣導活動']

export const TPL_FEES: [string, string, string, string][] = [
  ['日間照顧服務', '依長照給付及支付基準', '日', '長照給付對象依核定額度及部分負擔比率計收'],
  ['自費日間照顧', '（請填機構核定金額）', '月', '依主管機關核定之收費標準'],
  ['交通接送', '依長照給付及支付基準', '趟', ''],
  ['餐費', '（請填機構核定金額）', '餐', ''],
]

export const TPL_CASH: [string, string, string][] = [
  ['文具用品', '辦公文具、紙張、碳粉等', '1500'],
  ['活動材料', '手作、園藝等課程材料', '3000'],
  ['清潔用品', '清潔劑、消毒用品等', '2000'],
  ['郵電雜支', '郵資、快遞及其他小額支出', '500'],
]
