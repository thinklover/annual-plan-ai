import type { Phase } from './blocks'
import { itemTarget } from './defaults'
import type { Plan } from './types'

export interface ScriptQuestion {
  id: string
  block: string
  q: string
  tip?: string
  /** 依計畫書內容列出要逐項確認的項目，讓訪談人員照著念 */
  items?: (plan: Plan) => string[]
}

export interface InterviewScript {
  phase: Phase
  title: string
  intro: string[]
  questions: ScriptQuestion[]
  outro: string[]
}

const q = (id: string, block: string, text: string, tip?: string, items?: ScriptQuestion['items']): ScriptQuestion =>
  ({ id, block, q: text, tip, items })

const monthsText = (m: number[]) => (m.length === 12 ? '每月' : m.length ? `${m.join('、')} 月` : '')
const named = <T extends { name: string }>(rows: T[]) => rows.filter((r) => r.name.trim())

const opsItems = (plan: Plan) => named(plan.operations).map((it) => {
  const t = itemTarget(it, 'operations')
  const when = monthsText(it.months)
  return `${it.name}${t || when ? `（計畫${t ? ` ${t} 次` : ''}${when ? `，${when}` : ''}）` : ''}：實際辦了幾次？`
})
const actItems = (plan: Plan) => named(plan.activities).map((it) => {
  const when = monthsText(it.months)
  return `${it.name}${when ? `（${when}辦理）` : ''}：目標幾人次？實際幾人次？`
})
const staffItems = (plan: Plan) => plan.staffing.filter((s) => s.title.trim())
  .map((s) => `${s.title}${s.planCount.trim() ? `（原規劃 ${s.planCount} 位）` : ''}：實際聘用幾位？`)
const targetItems = (plan: Plan) => plan.serviceTargets.filter((t) => t.item.trim())
  .map((t) => `${t.item}${t.target.trim() ? `（目標 ${t.target} 人次）` : ''}：全年累積幾人次？`)

export const SCRIPTS: InterviewScript[] = [
  {
    phase: 'plan',
    title: '年初計畫訪談講稿',
    intro: [
      '建議受訪者：機構主任或業務負責人；時間約 60～90 分鐘。',
      '開場：「今天想請您談談機構的現況與明年的規劃，內容會整理成年度業務計畫書，訪談會錄音以便整理逐字稿。」',
      '逐字稿請以「訪談員：」「受訪者：」標示說話者；數字（人數、金額、百分比）請受訪者明確說出。',
    ],
    questions: [
      q('p01', 'basic', '請先確認機構的全名、服務類型，以及機構所在的縣市、行政區與地址。'),
      q('p02', 'basic', '這份計畫是哪一個年度的？機構的立案核准日期和開始營運日期是什麼時候？'),
      q('p03', 'vision', '您希望機構十年後在社區裡是什麼樣子？用一句話描述機構的願景。'),
      q('p04', 'vision', '為了達成這個願景，機構每天在做的核心工作是什麼？（使命）'),
      q('p05', 'vision', '團隊共同重視的價值有哪些？請說 3 到 5 個。'),
      q('p06', 'so', '【財務面】機構在收托人數、營收或薪資福利上有什麼優勢？外部有哪些機會（政策、補助、市場需求）？明年財務面的具體目標是什麼？', '請受訪者說出可衡量的數字，例如收托率、營收成長率。'),
      q('p07', 'so', '【顧客面】在服務品質、活動、照顧技巧、家屬關係上有什麼優勢與外部機會？明年要達成什麼目標？', '例如滿意度目標、活動場次。'),
      q('p08', 'so', '【內部流程】行政程序、溝通、資訊化方面有什麼優勢與機會？明年要改善什麼？'),
      q('p09', 'so', '【學習成長】員工培訓、專長、幹部培育方面有什麼優勢與機會？明年的目標是什麼？'),
      q('p10', 'okr', '如果明年只能完成一件最重要的事，會是什麼？（年度目標）'),
      q('p11', 'okr', '這個年度目標，第一季到第四季各要完成到什麼程度？'),
      q('p12', 'services', '機構目前提供哪些服務項目？明年有沒有要新增或停止的服務？'),
      q('p13', 'targets', '主要服務哪些對象？（例如失能、失智、衰弱長者、身心障礙者）'),
      q('p14', 'staff', '機構有哪些職務角色？彼此的上下層關係是什麼？'),
      q('p15', 'staff', '今年各職稱聘用幾位？明年預計各聘用幾位？各職務主要負責什麼？'),
      q('p16', 'serviceContent', '請逐項說明每一項服務的實際內容與做法。'),
      q('p17', 'satisfaction', '今年（或最近一次）滿意度調查的結果如何？整體滿意度大約多少？'),
      q('p18', 'satisfaction', '哪些題項分數較低？打算怎麼改善？明年的策略是什麼？'),
      q('p19', 'operations', '明年機構營運管理上固定要做哪些事？例如督導會議、教育訓練、感控、消防、演練、滿意度調查，各在哪幾個月做？'),
      q('p20', 'activities', '明年規劃哪些個案活動？例如運動、懷舊、手作、節慶、參訪，各在哪幾個月辦？'),
      q('p21', 'serviceTargets', '今年各項服務累積服務了多少人次？明年各項目標人次是多少？'),
      q('p22', 'fees', '機構目前的收費項目與金額是多少？（日照、交通、餐費、自費項目等）'),
      q('p23', 'pettyCash', '零用金每月大約編列多少？主要用在哪些項目？各項目每月多少錢？'),
    ],
    outro: ['結尾：「謝謝您，我們整理好計畫書初稿後，會再請您確認內容。」'],
  },
  {
    phase: 'review',
    title: '年終成果訪談講稿',
    intro: [
      '建議受訪者：機構主任或業務負責人；時間約 30～60 分鐘；請受訪者事先準備今年的執行紀錄（簽到表、會議紀錄、服務統計）。',
      '題目下方會自動列出年初計畫書的項目與目標，請逐項詢問並請受訪者說出數字；先完成年初計畫的填寫，清單才會出現。',
      '開場：「今天想請您回顧今年計畫的執行情形，內容會整理成執行成果報告。」',
      '逐字稿請以「訪談員：」「受訪者：」標示說話者；請受訪者逐項說出實際數字。',
    ],
    questions: [
      q('r01', 'resultsOps', '我們照年初的營運管理計畫一項一項對：每一項今年實際辦了幾次？',
        '問的是「辦了幾次（場）」，不是參加人次；受訪者若只說月份，請追問「所以總共幾次？」', opsItems),
      q('r02', 'resultsOps', '剛剛次數比計畫少、或沒有辦的項目，原因是什麼？明年打算怎麼調整？',
        '有達成的項目不用問；請受訪者講具體做法，例如改月份、改方式、找替代人力。'),
      q('r03', 'resultsActs', '接著是個案活動：每項活動年初的目標是多少人次？今年實際大約多少人次參加？',
        '人次＝每場人數加總，例如每月 1 場、每場 30 人 → 360 人次；請受訪者說出數字，不要只說「差不多」。', actItems),
      q('r04', 'resultsActs', '參加人次沒有達到目標、或場次被取消的活動，原因是什麼？明年要怎麼改善？',
        '有達成的活動不用問；改善作法請問到具體調整，例如換時段、準備雨備方案。'),
      q('r05', 'hiring', '人力的部分，各職稱今年實際聘用了幾位？', '和原規劃不同的職稱，請追問原因與目前招募情形。', staffItems),
      q('r06', 'targetResults', '最後是服務人次：各項服務今年全年累積服務了多少人次？',
        '請以全年累積的實際數字回答；年中才開辦的服務請說明從幾月開始。', targetItems),
      q('r07', 'targetResults', '沒有達到目標的服務項目，原因是什麼？明年打算怎麼改善？', '有達成的項目不用問。'),
    ],
    outro: ['結尾：「謝謝您，成果報告整理好後會再請您確認。」'],
  },
]
