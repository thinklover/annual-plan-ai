import { PERSPECTIVES } from './defaults'
import type { Plan } from './types'
import { isBlank } from './util'

export interface Col {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'months' | 'number'
}

export interface AiField {
  /** meta 的 key（AI 來源以此為單位） */
  key: string
  /** 資料在 Plan 中的路徑 */
  path: string
  label: string
  kind: 'text' | 'list' | 'table' | 'merge'
  hint?: string
  cols?: Col[]
  /** merge：以此欄位比對既有列 */
  matchKey?: string
  /** 文字欄位是否為多項條列 */
  bullets?: boolean
}

export type Phase = 'plan' | 'review'

export interface BlockDef {
  id: string
  no: string
  title: string
  desc: string
  phase: Phase
  /** 是否列入完成率 */
  counted: boolean
  fields: AiField[]
  /** 給 AI 的區塊專屬說明 */
  aiGuide?: string
  missing: (p: Plan) => string[]
}

const t = (path: string, label: string, hint?: string): AiField => ({ key: path, path, label, kind: 'text', hint })
const tb = (path: string, label: string, hint?: string): AiField => ({ ...t(path, label, hint), bullets: true })

const need = (pairs: [unknown, string][]) => pairs.filter(([v]) => isBlank(v)).map(([, l]) => l)

const PLAN_COLS: Col[] = [
  { key: 'name', label: '項目名稱' },
  { key: 'desc', label: '說明', type: 'textarea' },
  { key: 'months', label: '執行月份', type: 'months' },
]

const RESULT_TEXT_GUIDE =
  '未達原因只填受訪者說明「為什麼沒做到、為什麼較少」的內容（例如「3 月才開始，所以只有…」也算原因），有達成目標的項目留空；' +
  '改善作法可能在後面另一段一起回答（例如「明年要怎麼調整？」），請對應回各項目；' +
  '未達原因與改善作法都要改寫成正式書面語，例如「有幾堂下雨改室內，人少一點」→「部分場次因雨改於室內辦理，參與人數較少」。'

const OPS_RESULT_COLS: Col[] = [
  { key: 'name', label: '服務內容' },
  { key: 'actual', label: '實際執行次數', type: 'number' },
  { key: 'reason', label: '未達原因（有達成則留空）', type: 'textarea' },
  { key: 'improvement', label: '改善作法', type: 'textarea' },
]

const ACT_RESULT_COLS: Col[] = [
  { key: 'name', label: '活動名稱' },
  { key: 'target', label: '目標參與人次（逐字稿有提到才填）', type: 'number' },
  { key: 'actual', label: '實際參與人次', type: 'number' },
  { key: 'reason', label: '未達原因（有達成則留空）', type: 'textarea' },
  { key: 'improvement', label: '改善作法', type: 'textarea' },
]

export const BLOCKS: BlockDef[] = [
  {
    id: 'basic', no: '壹', title: '文件基本資料', phase: 'plan', counted: true,
    desc: '年度、機構與文件標題；計畫年度是後續各年度欄位的推算依據。',
    fields: [
      t('basic.orgName', '機構名稱'),
      t('basic.planYear', '計畫年度（民國年）', '只填數字，例如 115'),
      t('basic.serviceType', '服務類型', '例如：日間照顧服務'),
      t('basic.city', '縣市'),
      t('basic.district', '行政區'),
      t('basic.address', '地址'),
      t('basic.approvalDate', '立案核准日期', '民國年/月/日，例如 108/05/01'),
      t('basic.openDate', '開始營運日期', '民國年/月/日'),
    ],
    missing: (p) => need([
      [p.basic.orgName, '機構名稱'], [p.basic.planYear, '計畫年度'], [p.basic.serviceType, '服務類型'],
      [p.basic.city, '縣市'], [p.basic.district, '行政區'],
    ]),
  },
  {
    id: 'basis', no: '貳', title: '依據', phase: 'plan', counted: true,
    desc: '評鑑基準 A1 文字，作為年度業務計畫的依據。',
    fields: [],
    missing: (p) => need([[p.basis, '依據文字']]),
  },
  {
    id: 'vision', no: '參', title: '願景、使命與核心價值', phase: 'plan', counted: true,
    desc: '機構的長期願景、日常使命與共同遵循的核心價值。',
    aiGuide: '願景與使命各寫成一段完整的句子，不要條列。',
    fields: [
      t('vision.vision', '願景', '機構希望長期達成的理想樣貌，一句話'),
      t('vision.mission', '使命', '為達成願景，日常持續在做的事'),
      { key: 'vision.coreValues', path: 'vision.coreValues', label: '核心價值', kind: 'list', hint: '3～5 項短語' },
    ],
    missing: (p) =>
      isBlank(p.vision.vision) && isBlank(p.vision.mission) && isBlank(p.vision.coreValues)
        ? ['願景、使命與核心價值（至少一項）']
        : [],
  },
  {
    id: 'so', no: '肆', title: '創新策略（SO 計分卡）', phase: 'plan', counted: true,
    desc: '結合內部優勢 S 與外部機會 O，依平衡計分卡四大構面形成年度策略目標。',
    fields: [
      ...PERSPECTIVES.flatMap((pp) => [
        tb(`so.${pp.key}.s`, `${pp.label}－內部優勢 S`, `條列，${pp.hint}`),
        tb(`so.${pp.key}.o`, `${pp.label}－外部機會 O`, '條列'),
        tb(`so.${pp.key}.goal`, `${pp.label}－目標`, '第一行為目標標題，其後條列可衡量的具體目標'),
      ]),
      t('so.note', 'SO 計分卡說明', '受訪者有特別說明整體策略時才填，否則留空'),
    ],
    missing: (p) => PERSPECTIVES.filter((pp) => isBlank(p.so[pp.key].goal)).map((pp) => `${pp.label}目標`),
  },
  {
    id: 'okr', no: '伍', title: '整體目標', phase: 'plan', counted: true,
    desc: '先設定全年最重要的年度目標 O，再拆解為第一季至第四季的階段性目標。',
    aiGuide: '每個目標都改寫成簡潔的正式目標句，刪除口語與語氣詞，例如「第一季要先選系統，然後全部的人都要受訓」→「完成數位照護系統選定，並辦理全體員工教育訓練」。',
    fields: [
      t('okr.o', '年度目標 O', '一句清楚、具方向性的目標'),
      t('okr.q1', '第一季目標'), t('okr.q2', '第二季目標'), t('okr.q3', '第三季目標'), t('okr.q4', '第四季目標'),
    ],
    missing: (p) => need([
      [p.okr.o, '年度目標'], [p.okr.q1, '第一季'], [p.okr.q2, '第二季'], [p.okr.q3, '第三季'], [p.okr.q4, '第四季'],
    ]),
  },
  {
    id: 'services', no: '陸', title: '服務項目', phase: 'plan', counted: true,
    desc: '機構提供的服務項目，可新增、刪除、排序。',
    fields: [{ key: 'services', path: 'services', label: '服務項目', kind: 'table', cols: [{ key: 'name', label: '服務項目' }] }],
    missing: (p) => (p.services.some((s) => s.enabled && s.name.trim()) ? [] : ['至少 1 項服務項目']),
  },
  {
    id: 'targets', no: '柒', title: '服務對象', phase: 'plan', counted: true,
    desc: '機構服務的對象類型。',
    fields: [{ key: 'targets', path: 'targets', label: '服務對象', kind: 'table', cols: [{ key: 'name', label: '服務對象' }] }],
    missing: (p) => (p.targets.some((s) => s.enabled && s.name.trim()) ? [] : ['至少 1 項服務對象']),
  },
  {
    id: 'staff', no: '捌', title: '機構組織人力角色及人事編列', phase: 'plan', counted: true,
    desc: '設定人力角色與上層角色，再由角色產生人事編列表。',
    fields: [
      {
        key: 'roles', path: 'roles', label: '人力角色', kind: 'table',
        cols: [{ key: 'name', label: '角色名稱' }, { key: 'parent', label: '上層角色名稱（最上層留空）' }],
      },
      {
        key: 'staffing', path: 'staffing', label: '人事編列', kind: 'table',
        cols: [
          { key: 'title', label: '職稱' }, { key: 'prevCount', label: '前一年聘用人數', type: 'number' },
          { key: 'planCount', label: '本年度擬聘用人數', type: 'number' }, { key: 'duty', label: '職務說明', type: 'textarea' },
        ],
      },
    ],
    missing: (p) => (p.staffing.some((s) => s.title.trim()) ? [] : ['至少 1 列人事編列']),
  },
  {
    id: 'serviceContent', no: '玖', title: '服務內容說明', phase: 'plan', counted: true,
    desc: '機構提供之各項服務內容說明。',
    fields: [{
      key: 'serviceContent', path: 'serviceContent', label: '服務內容', kind: 'table',
      cols: [{ key: 'item', label: '服務項目' }, { key: 'content', label: '服務內容說明', type: 'textarea' }],
    }],
    missing: (p) => (p.serviceContent.some((s) => s.item.trim()) ? [] : ['至少 1 列服務內容']),
  },
  {
    id: 'satisfaction', no: '拾', title: '前一年度滿意度分析結果及改善方案', phase: 'plan', counted: true,
    desc: '前一年度滿意度調查的分析結果、待改善題項與改善方案。',
    fields: [
      t('satisfaction.year', '調查年度（民國年）'),
      tb('satisfaction.analysis', '滿意度分析結果', '含整體滿意度數字與主要發現'),
      tb('satisfaction.issues', '主要待改善題項'),
      tb('satisfaction.improvement', '改善方案'),
      tb('satisfaction.strategy', '本年度策略'),
    ],
    missing: (p) => need([[p.satisfaction.analysis, '分析結果'], [p.satisfaction.improvement, '改善方案']]),
  },
  {
    id: 'operations', no: '拾壹', title: '機構營運管理計畫', phase: 'plan', counted: true,
    desc: '營運管理項目與執行月份；連動至年度行事曆與執行成果報告。',
    fields: [{ key: 'operations', path: 'operations', label: '營運管理項目', kind: 'table', cols: PLAN_COLS }],
    aiGuide: '只列機構行政與管理類工作，例如督導會議、教育訓練、感染管制、消防安全、災害演練、個案複評、滿意度調查、環境與水質。慶生、歌唱、園藝、節慶、踏青、代間等「長輩參加的活動」屬於個案活動，不要列在這裡。',
    missing: (p) => (p.operations.some((s) => s.name.trim()) ? [] : ['至少 1 項營運管理項目']),
  },
  {
    id: 'activities', no: '拾貳', title: '個案活動管理計畫', phase: 'plan', counted: true,
    desc: '個案活動項目與執行月份；連動至年度行事曆與執行成果報告。',
    fields: [{ key: 'activities', path: 'activities', label: '個案活動項目', kind: 'table', cols: PLAN_COLS }],
    aiGuide: '只列長輩參加的活動，例如慶生會、懷舊歌唱、運動、園藝、手作、節慶、社區踏青、代間活動。督導會議、教育訓練、演練、稽核等行政管理工作不要列在這裡。逐字稿沒說月份的活動，months 回傳 []。',
    missing: (p) => (p.activities.some((s) => s.name.trim()) ? [] : ['至少 1 項活動']),
  },
  {
    id: 'serviceTargets', no: '拾參', title: '服務目標人數／人次', phase: 'plan', counted: true,
    desc: '本年度各服務的目標人數或人次；連動至成果統計。',
    fields: [{
      key: 'serviceTargets', path: 'serviceTargets', label: '服務目標', kind: 'table',
      cols: [
        { key: 'item', label: '服務項目' }, { key: 'prevCount', label: '前一年累積人次', type: 'number' },
        { key: 'target', label: '本年度目標人次', type: 'number' },
      ],
    }],
    missing: (p) => (p.serviceTargets.some((s) => s.item.trim()) ? [] : ['至少 1 項服務目標']),
  },
  {
    id: 'calendar', no: '拾肆', title: '年度行事曆', phase: 'plan', counted: true,
    desc: '由營運管理計畫與個案活動計畫自動產生；手動新增的項目標示為未連動。',
    fields: [],
    missing: (p) =>
      p.operations.length + p.activities.length + p.calendarManual.length > 0 ? [] : ['尚無行事曆項目'],
  },
  {
    id: 'fees', no: '拾伍', title: '收費基準', phase: 'plan', counted: true,
    desc: '收費項目與金額。收費涉及最新法規與地方主管機關規定，送審前請自行查核。',
    fields: [{
      key: 'fees', path: 'fees', label: '收費項目', kind: 'table',
      cols: [
        { key: 'item', label: '收費項目' }, { key: 'amount', label: '金額' }, { key: 'unit', label: '單位' },
        { key: 'note', label: '備註' },
      ],
    }],
    missing: (p) => (p.fees.some((s) => s.item.trim()) ? [] : ['至少 1 項收費項目']),
  },
  {
    id: 'pettyCash', no: '拾陸', title: '零用金預算表', phase: 'plan', counted: true,
    desc: '只填每月預算，年度預算與合計自動計算。',
    fields: [{
      key: 'pettyCash', path: 'pettyCash', label: '零用金項次', kind: 'table',
      cols: [
        { key: 'item', label: '經費項目' }, { key: 'content', label: '預算內容' },
        { key: 'monthly', label: '每月預算（元）', type: 'number' },
      ],
    }],
    missing: (p) => (p.pettyCash.some((s) => s.item.trim() && s.monthly.trim()) ? [] : ['至少 1 項零用金預算']),
  },
  {
    id: 'resultsOps', no: '拾柒', title: '執行成果報告（一）機構營運管理計畫', phase: 'review', counted: false,
    desc: '年度執行後回填，不列入完成率。項目由「機構營運管理計畫」帶入，目標值預設為執行月份數，可修改；達成率自動計算。',
    fields: [{
      key: 'results.operations', path: 'operations', label: '營運管理執行成果', kind: 'merge', matchKey: 'name',
      cols: OPS_RESULT_COLS,
    }],
    aiGuide: '「實際執行次數」是辦理的次數或場次（例如每月開一次 → 12），不是參與人次。受訪者說出辦理的月份時，次數＝月份數（例如「6 月、12 月」→ 2、「5 月就報了」→ 1）；說「每個月都有」→ 12。' + RESULT_TEXT_GUIDE,
    missing: () => [],
  },
  {
    id: 'resultsActs', no: '拾捌', title: '執行成果報告（二）個案活動管理計畫', phase: 'review', counted: false,
    desc: '年度執行後回填，不列入完成率。項目由「個案活動管理計畫」帶入，請填目標參與人次；達成率自動計算。',
    fields: [{
      key: 'results.activities', path: 'activities', label: '個案活動執行成果', kind: 'merge', matchKey: 'name',
      cols: ACT_RESULT_COLS,
    }],
    aiGuide: '「目標參與人次」與「實際參與人次」都是人次，不是場次。' + RESULT_TEXT_GUIDE,
    missing: () => [],
  },
  {
    id: 'hiring', no: '拾玖', title: '聘用人數統計', phase: 'review', counted: false,
    desc: '職稱與擬聘用人數由人事編列自動帶入，只需填實際聘用人數。',
    fields: [{
      key: 'results.staffing', path: 'staffing', label: '實際聘用人數', kind: 'merge', matchKey: 'title',
      cols: [{ key: 'title', label: '職稱' }, { key: 'actualCount', label: '實際聘用人數', type: 'number' }],
    }],
    missing: () => [],
  },
  {
    id: 'targetResults', no: '貳拾', title: '服務目標人數／人次成果統計', phase: 'review', counted: false,
    desc: '服務項目與年目標人次由「服務目標人數／人次」帶入，填年累積人次；達成率自動計算。',
    fields: [{
      key: 'results.serviceTargets', path: 'serviceTargets', label: '實際服務人次', kind: 'merge', matchKey: 'item',
      cols: [
        { key: 'item', label: '服務項目' }, { key: 'actual', label: '年累積人次', type: 'number' },
        { key: 'reason', label: '未達原因（有達成則留空）', type: 'textarea' }, { key: 'improvement', label: '改善作法', type: 'textarea' },
      ],
    }],
    aiGuide: RESULT_TEXT_GUIDE,
    missing: () => [],
  },
]

export const blockById = (id: string) => BLOCKS.find((b) => b.id === id)!

export function completion(p: Plan) {
  const counted = BLOCKS.filter((b) => b.counted)
  const done = counted.filter((b) => b.missing(p).length === 0).length
  return Math.round((done / counted.length) * 100)
}
