import { useState } from 'react'
import { generate, parseJson } from '../../gemini'
import { getSettings } from '../../storage'
import { byDate, capacityRows, fmtDate, fmtNum, inYear, pct, sumAvg, todayIso, yearLabel } from '../fmt'
import { exportDocx, type DocBlock } from '../exportDocx'
import { exportXlsx } from '../exportXlsx'
import { emptyReport, optionsOf, uid, useStore } from '../store'
import type { EvalData, Incident, IncidentKind, IncidentReport } from '../types'
import {
  Area, Card, DateIn, confirmDelete, EditActions, Field, NotFound, OptionSelect, orgName, Page, RecordTable, Text, useYear, YearSelect,
} from '../ui'

type TextKey = 'reporter' | 'description' | 'response' | 'followup' | 'supervisorNote' | 'managerNote'

const META: Record<IncidentKind, {
  no: string; title: string; record: string; report: string; optKey: string
  fields: [TextKey, string][]
}> = {
  accident: {
    no: '3-1', title: '意外或緊急事件', record: '意外或緊急事件紀錄', report: '意外事件分析檢討', optKey: 'accidentType',
    fields: [
      ['description', '事件說明（事發情境、人、時、地、物）'],
      ['response', '事發當下因應措施'],
      ['followup', '事件追蹤或結案說明'],
      ['supervisorNote', '主責居督（改善／回饋／預防／反思等說明）'],
      ['managerNote', '單位主管（改善／回饋／預防／反思等說明）'],
    ],
  },
  complaint: {
    no: '3-3', title: '意見反映或申訴事件', record: '意見反映或申訴事件紀錄', report: '意見反映/申訴事件分析與改善', optKey: 'complaintType',
    fields: [
      ['reporter', '意見反映或申訴者'],
      ['description', '事件說明（情境、人、時、地、物）'],
      ['response', '因應措施'],
      ['followup', '事件追蹤或結案說明'],
      ['supervisorNote', '主責居督（改善／回饋／預防／反思等說明）'],
      ['managerNote', '單位主管（改善／回饋／預防／反思等說明）'],
    ],
  },
}

const listOf = (d: EvalData, kind: IncidentKind, year: number) =>
  d.incidents.filter((x) => x.kind === kind && inYear(x.date, year)).sort(byDate)

export function IncidentList({ kind }: { kind: IncidentKind }) {
  const { data, update } = useStore()
  const { year } = useYear()
  const f = data.org.yearFormat
  const yl = yearLabel(year, f)
  const meta = META[kind]
  const list = listOf(data, kind, year)
  const base = `#/incidents/${kind}`

  const add = () => {
    const x: Incident = {
      id: uid(), kind, date: inYear(todayIso(), year) ? todayIso() : `${year}-01-01`, type: '', reporter: '',
      description: '', response: '', followup: '', supervisorNote: '', managerNote: '',
    }
    update((d) => { d.incidents.push(x) })
    location.hash = `${base}/${x.id}`
  }

  const exportTotal = () =>
    exportXlsx(`${yl}年度${meta.title}總表`, {
      org: orgName(data),
      title: `${yl}年度${meta.title}總表`,
      cols: [{ label: '發生日期', width: 12 }, { label: '事件類型', width: 14 }, ...meta.fields.map(([, label]) => ({ label, width: 30 }))],
      rows: list.map((x) => [fmtDate(x.date, f), x.type, ...meta.fields.map(([k]) => x[k])]),
    })

  return (
    <Page
      no={meta.no}
      title={meta.title}
      actions={<>
        <YearSelect />
        <a className="btn ghost" href={`${base}/report`}>年度分析與改善</a>
        <button type="button" className="btn ghost" disabled={!list.length} onClick={exportTotal}>匯出年度總表</button>
        <button type="button" className="btn" onClick={add}>＋ 新增事件</button>
      </>}
    >
      <RecordTable
        items={list}
        href={(x) => `${base}/${x.id}`}
        empty={`${yl}年度還沒有${meta.title}，按「新增事件」開始。`}
        cols={[
          { label: '發生日期', render: (x) => fmtDate(x.date, f), w: '7em' },
          { label: '事件類型', render: (x) => x.type, w: '8em' },
          ...(kind === 'complaint' ? [{ label: '反映者', render: (x: Incident) => x.reporter, w: '7em' }] : []),
          { label: '事件說明', render: (x) => <span className="clip">{x.description}</span> },
        ]}
      />
    </Page>
  )
}

export function IncidentEdit({ kind, id }: { kind: IncidentKind; id: string }) {
  const { data, update } = useStore()
  const x = data.incidents.find((y) => y.id === id)
  const back = `#/incidents/${kind}`
  if (!x) return <NotFound back={back} />
  const meta = META[kind]
  const f = data.org.yearFormat
  const set = (fn: (y: Incident) => void) =>
    update((d) => {
      const y = d.incidents.find((z) => z.id === id)
      if (y) fn(y)
    })

  const onWord = () =>
    exportDocx(`${meta.record}_${fmtDate(x.date, f)}`, [
      { t: 'title', sub: orgName(data), text: meta.record },
      { t: 'kv', pairs: [['發生日期', fmtDate(x.date, f)], ['事件類型', x.type]] },
      ...meta.fields.map(([k, label]) => ({ t: 'box' as const, label, text: x[k] })),
    ])
  const onDelete = () => {
    if (!confirmDelete('事件紀錄')) return
    update((d) => { d.incidents = d.incidents.filter((y) => y.id !== id) })
    location.hash = back
  }

  return (
    <Page no={meta.no} title={meta.record} back={back} actions={<EditActions onWord={onWord} onDelete={onDelete} />}>
      <Card title="事件紀錄">
        <div className="grid2">
          <Field label="發生日期"><DateIn value={x.date} onChange={(v) => set((y) => { y.date = v })} /></Field>
          <Field label="事件類型"><OptionSelect optKey={meta.optKey} value={x.type} onChange={(v) => set((y) => { y.type = v })} /></Field>
        </div>
        {meta.fields.map(([k, label]) => (
          <Field key={k} label={label}>
            {k === 'reporter'
              ? <Text value={x[k]} onChange={(v) => set((y) => { y[k] = v })} />
              : <Area value={x[k]} onChange={(v) => set((y) => { y[k] = v })} />}
          </Field>
        ))}
      </Card>
    </Page>
  )
}

/** 類型統計：預設類型＋實際出現的類型 */
function typeStats(d: EvalData, kind: IncidentKind, list: Incident[]) {
  const types = [...new Set([...optionsOf(d, META[kind].optKey), ...list.map((x) => x.type || '未分類')])]
  const total = list.length
  return {
    total,
    rows: types
      .map((t) => ({ type: t, count: list.filter((x) => (x.type || '未分類') === t).length }))
      .filter((r) => r.count > 0 || optionsOf(d, META[kind].optKey).includes(r.type))
      .map((r) => ({ ...r, pct: pct(r.count, total) })),
  }
}

function reportDoc(d: EvalData, kind: IncidentKind, year: number, rep: IncidentReport): DocBlock[] {
  const f = d.org.yearFormat
  const list = listOf(d, kind, year)
  const st = typeStats(d, kind, list)
  const title = `${yearLabel(year, f)}年度${META[kind].report}`
  const table: DocBlock =
    kind === 'accident'
      ? {
          t: 'table',
          headers: ['事件類別', '發生次數', '佔比', '主要內容簡述'],
          rows: st.rows.map((r) => [r.type, String(r.count), r.pct, rep.summaries[r.type] ?? '']),
          foot: [['總計', String(st.total), st.total ? '100%' : '0%', '']],
        }
      : {
          t: 'table',
          headers: ['項次', '事件類型', '數量(件)', '佔比'],
          rows: st.rows.map((r, i) => [String(i + 1), r.type, String(r.count), r.pct]),
          foot: [['', '合計', String(st.total), st.total ? '100%' : '0%']],
        }
  return [
    { t: 'title', sub: orgName(d), text: title },
    { t: 'h', text: kind === 'accident' ? '一、事件類別分類統計與佔比' : `一、事件類型件數統計（共計發生 ${st.total} 件）` },
    table,
    { t: 'h', text: '二、綜合原因分析' },
    { t: 'p', text: rep.cause },
    { t: 'h', text: '三、改善措施' },
    { t: 'p', text: rep.improvement },
  ]
}

function aiPrompt(d: EvalData, kind: IncidentKind, year: number) {
  const f = d.org.yearFormat
  const list = listOf(d, kind, year)
  const st = typeStats(d, kind, list)
  const cap = capacityRows(d, year)
  const avg = (k: 'cases' | 'claimants' | 'amount') => sumAvg(cap.map((r) => r[k]))
  const last = cap.filter((r) => r.cases || r.claimants).at(-1) ?? cap[11]
  const flow = (k: 'supNew' | 'supLeave' | 'cgNew' | 'cgLeave') => cap.reduce((a, r) => a + r.staff[k], 0)
  const o = d.org
  return [
    `# 機構基本資料`,
    `機構：${o.name}；設立日期：${fmtDate(o.foundedDate, f)}；地址：${o.address}`,
    `願景：${o.vision}`, `理念：${o.philosophy}`, `使命：${o.mission}`,
    ``,
    `# ${yearLabel(year, f)}年度服務量能`,
    `每月平均案管個案數 ${fmtNum(avg('cases').avg, 1)}、平均申報人數 ${fmtNum(avg('claimants').avg, 1)}、平均申報金額 ${fmtNum(avg('amount').avg)}。`,
    `最近月份人力：居督 男${last.staff.supM}/女${last.staff.supF}、照服員 男${last.staff.cgM}/女${last.staff.cgF}。`,
    `全年人力異動：新進居督 ${flow('supNew')}、離職居督 ${flow('supLeave')}、新進照服員 ${flow('cgNew')}、離職照服員 ${flow('cgLeave')}。`,
    ``,
    `# ${META[kind].title}類型統計（共 ${st.total} 件）`,
    ...st.rows.map((r) => `- ${r.type}：${r.count} 件（${r.pct}）`),
    ``,
    `# 事件明細`,
    ...list.map((x, i) =>
      [`## ${i + 1}. ${fmtDate(x.date, f)}【${x.type || '未分類'}】`, ...META[kind].fields.map(([k, label]) => (x[k] ? `${label}：${x[k]}` : ''))]
        .filter(Boolean)
        .join('\n'),
    ),
  ].join('\n')
}

const SYSTEM = `你是台灣長照居家服務機構的品質管理顧問，協助機構撰寫評鑑用的年度事件分析與改善報告。
請依使用者提供的機構基本資料、服務量能與年度事件紀錄，歸納出 3～5 個關鍵要因，並為每個要因提出具體可行的行動方案。
要求：
- 要因必須有事件紀錄或數據根據，引用件數、占比或具體情境；不要捏造資料中沒有的事件。
- 行動方案要具體（誰、做什麼、頻率或期限、如何追蹤），符合居家服務單位的實際能力。
- 使用繁體中文、台灣長照用語，正式書面語氣。
- cause 與 improvement 以相同編號一一對應，格式如「1. 標題：說明」，每項一段，段落間以換行分隔。
只輸出 JSON：{"cause": "…", "improvement": "…"}`

export function IncidentReportPage({ kind }: { kind: IncidentKind }) {
  const { data, update } = useStore()
  const { year } = useYear()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const meta = META[kind]
  const f = data.org.yearFormat
  const key = `${kind}-${year}`
  const rep = data.reports[key] ?? emptyReport()
  const list = listOf(data, kind, year)
  const st = typeStats(data, kind, list)
  const set = (fn: (r: IncidentReport) => void) => update((d) => { fn((d.reports[key] ??= emptyReport())) })
  const title = `${yearLabel(year, f)}年度${meta.report}`

  const runAi = async () => {
    setErr('')
    if (!list.length) return setErr('本年度沒有事件紀錄，無法分析。')
    if ((rep.cause.trim() || rep.improvement.trim()) && !window.confirm('AI 建議會覆蓋目前的原因分析與改善措施，確定嗎？')) return
    setBusy(true)
    try {
      const out = parseJson<{ cause?: string; improvement?: string }>(await generate(getSettings(), SYSTEM, aiPrompt(data, kind, year)))
      set((r) => {
        r.cause = (out.cause ?? '').trim()
        r.improvement = (out.improvement ?? '').trim()
      })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page
      no={meta.no}
      title={`年度分析與改善：${meta.title}`}
      back={`#/incidents/${kind}`}
      actions={<>
        <YearSelect />
        <button type="button" className="btn" onClick={() => exportDocx(title, reportDoc(data, kind, year, rep))}>匯出 Word</button>
      </>}
    >
      <Card title={kind === 'accident' ? '一、事件類別分類統計與佔比' : '一、事件類型件數統計'}>
        <p className="help">由本年度事件紀錄自動統計（共 {st.total} 件）。</p>
        <table className="grid">
          <thead>
            <tr>
              <th>事件類別</th><th>件數</th><th>佔比</th>
              {kind === 'accident' && <th>主要內容簡述（人工填寫）</th>}
            </tr>
          </thead>
          <tbody>
            {st.rows.map((r) => (
              <tr key={r.type}>
                <td>{r.type}</td><td>{r.count}</td><td>{r.pct}</td>
                {kind === 'accident' && (
                  <td><input value={rep.summaries[r.type] ?? ''} onChange={(e) => set((x) => { x.summaries[r.type] = e.target.value })} /></td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td>合計</td><td>{st.total}</td><td>{st.total ? '100%' : '0%'}</td>{kind === 'accident' && <td />}</tr>
          </tfoot>
        </table>
      </Card>

      <Card
        title="二、綜合原因分析／三、改善措施"
        actions={<button type="button" className="btn small" disabled={busy} onClick={runAi}>{busy ? 'AI 分析中…' : 'AI 建議'}</button>}
      >
        <p className="help">
          按「AI 建議」，由 AI 依本年度事件紀錄、機構基本資料與服務量能，提出 3～5 個關鍵要因與具體行動方案，填入後可直接修改。
          {!getSettings().apiKey && <b> 尚未設定 Gemini API Key，請到首頁「AI 設定」。</b>}
        </p>
        {err && <div className="err">{err}</div>}
        <Field label="二、綜合原因分析"><Area value={rep.cause} rows={6} onChange={(v) => set((r) => { r.cause = v })} /></Field>
        <Field label="三、改善措施"><Area value={rep.improvement} rows={6} onChange={(v) => set((r) => { r.improvement = v })} /></Field>
      </Card>
    </Page>
  )
}
