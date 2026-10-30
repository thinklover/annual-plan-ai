import {
  AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx'
import { BLOCKS, blockById } from './blocks'
import { calendarRows } from './calendar'
import { makeTitle, PERSPECTIVES } from './defaults'
import type { InterviewScript } from './scripts'
import type { Plan, PlanItem } from './types'
import { download, num } from './util'

// 標楷體中文、Times New Roman 英數，12pt、1.5 倍行高
const STYLES = {
  default: {
    document: {
      run: { font: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: '標楷體' }, size: 24 },
      paragraph: { spacing: { line: 360, after: 60 } },
    },
  },
}

const p = (text: string, opts: { bold?: boolean; size?: number; center?: boolean; indent?: boolean } = {}) =>
  new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    indent: opts.indent ? { left: 480 } : undefined,
    children: [new TextRun({ text, bold: opts.bold, size: opts.size })],
  })

const lines = (text: string, indent = true) =>
  (text || '（未填寫）').split('\n').filter((l) => l.trim()).map((l) => p(l, { indent }))

const h2 = (text: string) => new Paragraph({ spacing: { before: 360, after: 120 }, children: [new TextRun({ text, bold: true, size: 28 })] })
const h3 = (text: string) => new Paragraph({ spacing: { before: 160, after: 60 }, children: [new TextRun({ text, bold: true })] })

const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }

function table(headers: string[], rows: string[][]) {
  const cell = (t: string, bold = false) =>
    new TableCell({
      borders: { top: border, bottom: border, left: border, right: border },
      children: (t || '').split('\n').map((l) => new Paragraph({ spacing: { line: 300, after: 0 }, children: [new TextRun({ text: l, bold, size: 22 })] })),
    })
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h) => cell(h, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) })),
    ],
  })
}

const monthsText = (m: number[]) => (m.length === 12 ? '每月' : m.length ? `${m.join('、')} 月` : '')

function sectionContent(plan: Plan, id: string): (Paragraph | Table)[] {
  const y = num(plan.basic.planYear) || '本'
  const prev = typeof y === 'number' ? y - 1 : '前一'
  switch (id) {
    case 'basic': {
      const b = plan.basic
      return [table(['項目', '內容'], [
        ['機構名稱', b.orgName], ['計畫年度', b.planYear ? `民國 ${b.planYear} 年` : ''], ['服務類型', b.serviceType],
        ['地址', `${b.city}${b.district}${b.address}`], ['立案核准日期', b.approvalDate], ['開始營運日期', b.openDate],
        ['版本日期', b.versionDate],
      ])]
    }
    case 'basis':
      return lines(plan.basis)
    case 'vision':
      return [
        h3('一、願景'), ...lines(plan.vision.vision),
        h3('二、使命'), ...lines(plan.vision.mission),
        h3('三、核心價值'), ...plan.vision.coreValues.filter((v) => v.trim()).map((v, i) => p(`${i + 1}. ${v}`, { indent: true })),
      ]
    case 'so':
      return [
        table(['構面', '內部優勢 S', '外部機會 O', '目標'],
          PERSPECTIVES.map((pp) => [pp.label, plan.so[pp.key].s, plan.so[pp.key].o, plan.so[pp.key].goal])),
        ...(plan.so.note.trim() ? [h3('說明'), ...lines(plan.so.note)] : []),
      ]
    case 'okr':
      return [
        h3('年度目標'), ...lines(plan.okr.o),
        table(['季別', '階段目標'], [['第一季', plan.okr.q1], ['第二季', plan.okr.q2], ['第三季', plan.okr.q3], ['第四季', plan.okr.q4]]),
      ]
    case 'services':
    case 'targets':
      return plan[id].filter((s) => s.enabled && s.name.trim()).map((s, i) => p(`${i + 1}. ${s.name}`, { indent: true }))
    case 'staff':
      return [
        h3('一、人力角色'),
        table(['角色', '上層角色'], plan.roles.filter((r) => r.enabled && r.name.trim()).map((r) => [r.name, r.parent || '—'])),
        h3('二、人事編列'),
        table(['職稱', `${prev}年聘用人數`, `${y}年擬聘用人數`, '職務說明'],
          plan.staffing.map((s) => [s.title, s.prevCount, s.planCount, s.duty])),
      ]
    case 'serviceContent':
      return [table(['序號', '服務項目', '服務內容說明'], plan.serviceContent.map((s, i) => [String(i + 1), s.item, s.content]))]
    case 'satisfaction': {
      const s = plan.satisfaction
      return [
        h3(`一、${s.year ? `${s.year} 年度` : ''}滿意度分析結果`), ...lines(s.analysis),
        h3('二、主要待改善題項'), ...lines(s.issues),
        h3('三、改善方案'), ...lines(s.improvement),
        h3('四、本年度策略'), ...lines(s.strategy),
      ]
    }
    case 'operations':
    case 'activities':
      return [table(['序號', '項目', '說明', '執行月份'], plan[id].map((it, i) => [String(i + 1), it.name, it.desc, monthsText(it.months)]))]
    case 'serviceTargets':
      return [table(['服務項目', `${prev}年服務累積人次`, `${y}年目標服務人次`], plan.serviceTargets.map((t) => [t.item, t.prevCount, t.target]))]
    case 'calendar':
      return [table(['類別', '項目', ...Array.from({ length: 12 }, (_, i) => `${i + 1}月`)],
        calendarRows(plan).map((r) => [r.category, r.name, ...Array.from({ length: 12 }, (_, i) => (r.months.includes(i + 1) ? '●' : ''))]))]
    case 'fees':
      return [table(['收費項目', '金額', '單位', '備註'], plan.fees.map((f) => [f.item, f.amount, f.unit, f.note]))]
    case 'pettyCash': {
      const total = plan.pettyCash.reduce((s, r) => s + num(r.monthly), 0)
      return [table(['項次', '經費項目', '預算內容', '每月預算（元）', '年度預算（元）'], [
        ...plan.pettyCash.map((r, i) => [String(i + 1), r.item, r.content, num(r.monthly).toLocaleString(), (num(r.monthly) * 12).toLocaleString()]),
        ['', '合計', '', total.toLocaleString(), (total * 12).toLocaleString()],
      ])]
    }
    case 'resultsOps':
    case 'resultsActs': {
      const items: PlanItem[] = id === 'resultsOps' ? plan.operations : plan.activities
      return [table(['項目', '執行成果', '參與人次', '達成率', '檢討與改善'],
        items.map((it) => [it.name, it.result, it.participants, it.rate, it.improvement]))]
    }
    case 'hiring':
      return [table(['職稱', `${y}年原先擬聘用人數`, `${y}年實際聘用人數`], plan.staffing.map((s) => [s.title, s.planCount, s.actualCount]))]
    case 'targetResults':
      return [table(['服務項目', `${y}年目標人次`, `${y}年實際人次`, '達成率'], plan.serviceTargets.map((t) => [
        t.item, t.target, t.actual, num(t.target) && t.actual.trim() ? `${Math.round((num(t.actual) / num(t.target)) * 100)}%` : '',
      ]))]
    default:
      return []
  }
}

export async function exportPlanDocx(plan: Plan) {
  const title = plan.basic.title.trim() || makeTitle(plan)
  const children: (Paragraph | Table)[] = [
    new Paragraph({ spacing: { before: 2400 } }),
    p(plan.basic.orgName || '○○機構', { bold: true, size: 36, center: true }),
    p(`${plan.basic.planYear || '○○○'} 年度業務計畫書`, { bold: true, size: 44, center: true }),
    p(`${plan.basic.madeYear} 年 ${plan.basic.madeMonth} 月制定`, { center: true }),
    new Paragraph({ pageBreakBefore: true }),
  ]
  for (const b of BLOCKS) {
    children.push(h2(`${b.no}、${b.title.replace(/^執行成果報告/, '執行成果報告：')}`), ...sectionContent(plan, b.id))
  }
  const doc = new Document({ styles: STYLES, title, sections: [{ children }] })
  download(`${title}.docx`, await Packer.toBlob(doc))
}

export async function exportScriptDocx(script: InterviewScript, plan: Plan) {
  const children: Paragraph[] = [
    p(script.title, { bold: true, size: 32, center: true }),
    p(`${plan.basic.orgName || '○○機構'}　${plan.basic.planYear || '○○○'} 年度`, { center: true }),
    h3('訪談須知'),
    ...script.intro.map((t) => p(`・${t}`, { indent: true })),
    h3('訪談題目'),
  ]
  let last = ''
  script.questions.forEach((q, i) => {
    const b = blockById(q.block)
    if (b.id !== last) {
      children.push(h3(`【${b.no}、${b.title}】`))
      last = b.id
    }
    children.push(p(`☐ ${i + 1}. ${q.q}`, { indent: true }))
    if (q.tip) children.push(p(`提示：${q.tip}`, { indent: true, size: 20 }))
  })
  children.push(h3('結尾'), ...script.outro.map((t) => p(`・${t}`, { indent: true })))
  const doc = new Document({ styles: STYLES, sections: [{ children }] })
  download(`${script.title}.docx`, await Packer.toBlob(doc))
}
