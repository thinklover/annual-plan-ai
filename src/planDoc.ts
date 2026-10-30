// 計畫書內容的中性結構：Word 匯出與網頁預覽共用，確保兩者內容一致
import { BLOCKS } from './blocks'
import { calendarRows } from './calendar'
import { achieveRate, itemTarget, makeTitle, PERSPECTIVES } from './defaults'
import type { Plan, PlanItem } from './types'
import { num } from './util'

export type DocNode =
  | { t: 'h3'; text: string }
  | { t: 'p'; text: string }
  | { t: 'table'; headers: string[]; rows: string[][] }

export interface DocSection {
  id: string
  heading: string
  nodes: DocNode[]
}

export interface PlanDoc {
  title: string
  orgName: string
  yearLine: string
  madeLine: string
  sections: DocSection[]
}

const h3 = (text: string): DocNode => ({ t: 'h3', text })
const p = (text: string): DocNode => ({ t: 'p', text })
const table = (headers: string[], rows: string[][]): DocNode => ({ t: 'table', headers, rows })
const lines = (text: string) => (text || '（未填寫）').split('\n').filter((l) => l.trim()).map(p)

const monthsText = (m: number[]) => (m.length === 12 ? '每月' : m.length ? `${m.join('、')} 月` : '')

function sectionNodes(plan: Plan, id: string): DocNode[] {
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
        h3('三、核心價值'), ...plan.vision.coreValues.filter((v) => v.trim()).map((v, i) => p(`${i + 1}. ${v}`)),
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
      return plan[id].filter((s) => s.enabled && s.name.trim()).map((s, i) => p(`${i + 1}. ${s.name}`))
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
      const kind = id === 'resultsOps' ? 'operations' : 'activities'
      const items: PlanItem[] = plan[kind]
      return [table([kind === 'operations' ? '服務內容' : '活動名稱', '目標值', kind === 'operations' ? '執行次數' : '參與人次', '達成率(%)', '未達原因', '改善作法'],
        items.map((it) => {
          const target = itemTarget(it, kind)
          return [it.name, target, it.actual, achieveRate(it.actual, target, num), it.reason, it.improvement]
        }))]
    }
    case 'hiring':
      return [table(['職稱', `${y}年原先擬聘用人數`, `${y}年實際聘用人數`], plan.staffing.map((s) => [s.title, s.planCount, s.actualCount]))]
    case 'targetResults':
      return [table(['服務項目', `${y}年目標人次`, `${y}年累積人次`, '達成率(%)', '未達原因', '改善作法'], plan.serviceTargets.map((t) => [
        t.item, t.target, t.actual, achieveRate(t.actual, t.target, num), t.reason, t.improvement,
      ]))]
    default:
      return []
  }
}

export function buildPlanDoc(plan: Plan): PlanDoc {
  return {
    title: plan.basic.title.trim() || makeTitle(plan),
    orgName: plan.basic.orgName || '○○機構',
    yearLine: `${plan.basic.planYear || '○○○'} 年度業務計畫書`,
    madeLine: `${plan.basic.madeYear} 年 ${plan.basic.madeMonth} 月制定`,
    sections: BLOCKS.map((b) => ({
      id: b.id,
      heading: `${b.no}、${b.title.replace(/^執行成果報告/, '執行成果報告：')}`,
      nodes: sectionNodes(plan, b.id),
    })),
  }
}
