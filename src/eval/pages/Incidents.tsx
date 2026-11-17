import { useState } from 'react'
import { generate, parseJson } from '../../gemini'
import { getSettings } from '../../storage'
import { activeInYear, byDate, capacityRows, fmtDate, fmtNum, inYear, isSupervisor, pct, sumAvg, todayIso, yearLabel } from '../fmt'
import { exportDocx, type DocBlock } from '../exportDocx'
import { exportXlsx } from '../exportXlsx'
import { emptyImprovement, emptyReport, optionsOf, uid, usePruneDrafts, useStore } from '../store'
import type { EvalData, Incident, IncidentKind, IncidentReport } from '../types'
import {
  AiKeyHint, Area, Card, DateIn, confirmDelete, EditActions, Field, NameInput, NotFound, OptionSelect, orgName, Page, RecordTable, Text,
  useNames, useYear, YearSelect,
} from '../ui'

type TextKey = 'reporter' | 'description' | 'response' | 'followup' | 'supervisorNote' | 'managerNote'

const META: Record<IncidentKind, {
  title: string; record: string; report: string; optKey: string
  fields: [TextKey, string][]
}> = {
  accident: {
    title: '意外或緊急事件', record: '意外或緊急事件紀錄', report: '意外事件分析檢討', optKey: 'accidentType',
    fields: [
      ['description', '事件說明（事發情境、人、時、地、物）'],
      ['response', '事發當下因應措施'],
      ['followup', '事件追蹤或結案說明'],
      ['supervisorNote', '主責居督（改善／回饋／預防／反思等說明）'],
      ['managerNote', '單位主管（改善／回饋／預防／反思等說明）'],
    ],
  },
  complaint: {
    title: '意見反映或申訴事件', record: '意見反映或申訴事件紀錄', report: '意見反映/申訴事件分析與改善', optKey: 'complaintType',
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

/** 「主責居督」「單位主管」兩欄各自對應的姓名欄位 */
const NAME_KEY: Partial<Record<TextKey, { key: 'supervisorName' | 'managerName'; role: string }>> = {
  supervisorNote: { key: 'supervisorName', role: '主責居督' },
  managerNote: { key: 'managerName', role: '單位主管' },
}
/** 匯出用的標題：帶入姓名，例如「主責居督 王小明（改善／回饋…）」 */
const labelOf = (x: Incident, k: TextKey, label: string) => {
  const n = NAME_KEY[k]
  const name = n ? x[n.key].trim() : ''
  return n && name ? label.replace(n.role, `${n.role} ${name}`) : label
}
const filledRows = (rep: IncidentReport) => rep.improvements.filter((r) => r.problem.trim() || r.measure.trim())

const listOf = (d: EvalData, kind: IncidentKind, year: number) =>
  d.incidents.filter((x) => x.kind === kind && inYear(x.date, year)).sort(byDate)

/** 事件列表／年度分析與改善 兩個分頁 */
function IncidentTabs({ kind, on }: { kind: IncidentKind; on: 'list' | 'report' }) {
  const base = `#/incidents/${kind}`
  return (
    <nav className="seg stage-tabs">
      <a href={base} className={on === 'list' ? 'on' : ''}>事件列表</a>
      <a href={`${base}/report`} className={on === 'report' ? 'on' : ''}>年度分析與改善</a>
    </nav>
  )
}

export function IncidentList({ kind }: { kind: IncidentKind }) {
  const { data, update, go } = useStore()
  const { year } = useYear()
  const f = data.org.yearFormat
  const yl = yearLabel(year, f)
  const meta = META[kind]
  usePruneDrafts()
  const list = listOf(data, kind, year)
  const base = `#/incidents/${kind}`

  const add = () => {
    // 主責居督、單位主管由員工名冊帶入：居督優先帶職稱是「督導員」的人，主管帶職稱含「負責人／主管／主任」的人
    const active = data.employees.filter((e) => e.name && activeInYear(e, year) && !e.leaveDate)
    const sups = active.filter(isSupervisor)
    const x: Incident = {
      id: uid(), kind, date: inYear(todayIso(), year) ? todayIso() : `${year}-01-01`, type: '', reporter: '',
      description: '', response: '', followup: '', supervisorNote: '', managerNote: '',
      supervisorName: (sups.find((e) => /督導/.test(e.title)) ?? sups[0])?.name ?? '',
      managerName: active.find((e) => /負責人|主管|主任/.test(e.title))?.name ?? '',
      draft: true,
    }
    update((d) => { d.incidents.push(x) })
    go(`${base}/${x.id}`)
  }

  const exportTotal = () =>
    exportXlsx(`${yl}年度${meta.title}總表`, {
      org: orgName(data),
      title: `${yl}年度${meta.title}總表`,
      cols: [{ label: '發生日期', width: 12 }, { label: '事件類型', width: 14 }, ...meta.fields.map(([, label]) => ({ label, width: 30 }))],
      rows: list.map((x) => [fmtDate(x.date, f), x.type, ...meta.fields.map(([k]) => {
        const name = NAME_KEY[k] ? x[NAME_KEY[k].key].trim() : ''
        return name && x[k] ? `${name}：${x[k]}` : x[k]
      })]),
    })

  return (
    <Page
      title={meta.title}
      actions={<>
        <YearSelect />
        <button type="button" className="btn ghost" disabled={!list.length} onClick={exportTotal}>匯出年度總表</button>
        <button type="button" className="btn" onClick={add}>＋ 新增事件</button>
      </>}
    >
      <IncidentTabs kind={kind} on="list" />
      <RecordTable
        items={list}
        href={(x) => `${base}/${x.id}`}
        empty={`${yl}年度還沒有${meta.title}，按「新增事件」開始。`}
        what={`${meta.title}紀錄`}
        label={(x) => `發生日期：${fmtDate(x.date, f)}${x.type ? `　事件類型：${x.type}` : ''}`}
        remove={(d, x) => { d.incidents = d.incidents.filter((y) => y.id !== x.id) }}
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
  const { data, update, updateNow, go } = useStore()
  const names = useNames()
  const x = data.incidents.find((y) => y.id === id)
  const back = `#/incidents/${kind}`
  if (!x) return <NotFound back={back} />
  const meta = META[kind]
  const f = data.org.yearFormat
  const set = (fn: (y: Incident) => void) =>
    update((d) => {
      const y = d.incidents.find((z) => z.id === id)
      if (!y) return
      fn(y)
      delete y.draft
    })

  const onWord = () =>
    exportDocx(`${meta.record}_${fmtDate(x.date, f)}`, [
      { t: 'title', sub: orgName(data), text: meta.record },
      { t: 'kv', pairs: [['發生日期', fmtDate(x.date, f)], ['事件類型', x.type]] },
      ...meta.fields.map(([k, label]) => ({ t: 'box' as const, label: labelOf(x, k, label), text: x[k] })),
    ])
  const onDelete = () => {
    if (!confirmDelete('事件紀錄')) return
    void updateNow((d) => { d.incidents = d.incidents.filter((y) => y.id !== id) }).then((ok) => ok && go(back))
  }

  return (
    <Page title={meta.record} back={back} actions={<EditActions onWord={onWord} onDelete={onDelete} />}>
      <Card title="事件紀錄">
        <div className="grid2">
          <Field label="發生日期"><DateIn value={x.date} onChange={(v) => set((y) => { y.date = v })} /></Field>
          <Field label="事件類型"><OptionSelect optKey={meta.optKey} value={x.type} onChange={(v) => set((y) => { y.type = v })} /></Field>
        </div>
        {meta.fields.map(([k, label]) => (
          <Field key={k} label={label}>
            {NAME_KEY[k] && (
              <div className="name-line">
                <span>{NAME_KEY[k].role}姓名</span>
                <NameInput names={names} value={x[NAME_KEY[k].key]} onChange={(v) => set((y) => { y[NAME_KEY[k]!.key] = v })} />
              </div>
            )}
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

/** 第二章標題，依各自的參考報告 */
const CAUSE_TITLE: Record<IncidentKind, string> = { accident: '綜合原因分析', complaint: '事件分析原因' }

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
  const rows = filledRows(rep)
  const improveTable: DocBlock = {
    t: 'table',
    headers: ['項次', '改善問題', '改善措施'],
    rows: rows.map((r, i) => [String(i + 1), r.problem, r.measure]),
  }
  // 整年沒有事件：不印全 0 的統計表，直接寫明無事件
  if (!st.total) {
    const hasCause = !!rep.cause.trim()
    return [
      { t: 'title', sub: orgName(d), text: title },
      { t: 'p', text: `${yearLabel(year, f)}年度未發生${META[kind].title}。` },
      ...(hasCause ? ([{ t: 'h', text: `一、${CAUSE_TITLE[kind]}` }, { t: 'p', text: rep.cause }] as DocBlock[]) : []),
      ...(rows.length ? ([{ t: 'h', text: `${hasCause ? '二' : '一'}、改善措施` }, improveTable] as DocBlock[]) : []),
    ]
  }
  return [
    { t: 'title', sub: orgName(d), text: title },
    { t: 'h', text: kind === 'accident' ? '一、事件類別分類統計與佔比' : `一、事件類型件數統計（共計發生 ${st.total} 件）` },
    table,
    { t: 'h', text: `二、${CAUSE_TITLE[kind]}` },
    { t: 'p', text: rep.cause },
    { t: 'h', text: '三、改善措施' },
    improveTable,
  ]
}

function aiPrompt(d: EvalData, kind: IncidentKind, year: number) {
  const f = d.org.yearFormat
  const list = listOf(d, kind, year)
  const st = typeStats(d, kind, list)
  const cap = capacityRows(d, year)
  const avg = (k: 'cases' | 'claimants' | 'amount') => sumAvg(cap.map((r) => r[k]))
  const last = cap.filter((r) => !r.future).at(-1) ?? cap[0]
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
      [`## ${i + 1}. ${fmtDate(x.date, f)}【${x.type || '未分類'}】`, ...META[kind].fields.map(([k, label]) => (x[k] ? `${labelOf(x, k, label)}：${x[k]}` : ''))]
        .filter(Boolean)
        .join('\n'),
    ),
  ].join('\n')
}

const SYSTEM = `你是台灣長照居家服務機構的品質管理顧問，協助機構撰寫評鑑用的年度事件分析與改善報告。
請依使用者提供的機構基本資料、服務量能、年度事件類型統計與事件紀錄，進一步分析並歸納出 3～5 個關鍵原因，再針對每個原因提出改善問題與改善措施。
要求：
- 關鍵原因必須有事件紀錄或統計數據根據，引用件數、占比或具體情境；不要捏造資料中沒有的事件。事件很少時，原因可以少於 3 個，不要硬湊。
- cause：關鍵原因，格式如「1. 標題：說明」，每項一段，段落間以換行分隔。
- improvements：與關鍵原因一一對應。problem＝要改善的問題（一句話點出問題）；measure＝改善措施（誰、做什麼、頻率或期限、如何追蹤），要具體且符合居家服務單位的實際能力，多項措施以「1. 」「2. 」分行。
- 使用繁體中文、台灣長照用語，正式書面語氣。
只輸出 JSON：{"cause": "…", "improvements": [{"problem": "…", "measure": "…"}]}`

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
    if ((rep.cause.trim() || filledRows(rep).length) && !window.confirm('AI 建議會覆蓋目前的原因分析與改善措施，確定嗎？')) return
    setBusy(true)
    try {
      const out = parseJson<{ cause?: string; improvements?: { problem?: string; measure?: string }[] }>(
        await generate(getSettings(), SYSTEM, aiPrompt(data, kind, year)),
      )
      const rows = (out.improvements ?? [])
        .map((r) => ({ id: uid(), problem: String(r.problem ?? '').trim(), measure: String(r.measure ?? '').trim() }))
        .filter((r) => r.problem || r.measure)
      set((r) => {
        r.cause = String(out.cause ?? '').trim()
        r.improvements = rows.length ? rows : [emptyImprovement()]
      })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page
      title={meta.title}
      submit
      actions={<>
        <YearSelect />
        <button type="button" className="btn" onClick={() => exportDocx(title, reportDoc(data, kind, year, rep))}>匯出 Word</button>
      </>}
    >
      <IncidentTabs kind={kind} on="report" />
      <Card title={kind === 'accident' ? '一、事件類別分類統計與佔比' : '一、事件類型件數統計'} tip={`由本年度事件紀錄自動統計（共 ${st.total} 件）。`}>
        {!st.total && <div className="notice">本年度沒有事件紀錄，匯出的 Word 會寫「{yearLabel(year, f)}年度未發生{meta.title}」，不印統計表。</div>}
        <div className="table-wrap"><table className="grid">
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
        </table></div>
      </Card>

      <Card
        title={`二、${CAUSE_TITLE[kind]}／三、改善措施`}
        tip="按「AI 建議」，由 AI 依本年度事件紀錄與類型統計、機構基本資料與服務量能，進一步分析提列 3～5 個關鍵原因，並逐項提出改善問題與改善措施，填入後可直接修改。"
        actions={<button type="button" className="btn small" disabled={busy} onClick={runAi}>{busy ? 'AI 分析中…' : 'AI 建議'}</button>}
      >
        <div className="help"><AiKeyHint /></div>
        {err && <div className="err">{err}</div>}
        <Field label={`二、${CAUSE_TITLE[kind]}`}><Area value={rep.cause} rows={6} onChange={(v) => set((r) => { r.cause = v })} /></Field>
        <Field label="三、改善措施">
          <div className="table-wrap">
            <table className="grid">
              <thead><tr><th className="no">#</th><th style={{ width: '34%' }}>改善問題</th><th>改善措施</th><th /></tr></thead>
              <tbody>
                {rep.improvements.map((r, i) => (
                  <tr key={r.id}>
                    <td className="no">{i + 1}</td>
                    <td><Area value={r.problem} rows={2} onChange={(v) => set((x) => { x.improvements[i].problem = v })} /></td>
                    <td><Area value={r.measure} rows={2} onChange={(v) => set((x) => { x.improvements[i].measure = v })} /></td>
                    <td className="ops"><button type="button" className="icon" title="刪除這一列" onClick={() => set((x) => { x.improvements.splice(i, 1) })}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div><button type="button" className="btn tiny ghost" onClick={() => set((x) => { x.improvements.push(emptyImprovement()) })}>＋ 新增一列</button></div>
        </Field>
      </Card>
    </Page>
  )
}
