import { useState } from 'react'
import { capacityRows, yearLabel } from '../fmt'
import { exportDocx, type DocBlock } from '../exportDocx'
import { emptyAction, emptyOkr, emptyPlan, useStore } from '../store'
import type { AnnualPlan, EvalData, Okr, PlanAction } from '../types'
import { Area, Card, Field, move, orgName, Page, useYear, YearSelect } from '../ui'
import { serviceTable } from './Capacity'
import { cnNo } from './Meetings'

type Stage = 'start' | 'mid' | 'end'
const STAGES: { key: Stage; label: string }[] = [
  { key: 'start', label: '年初計畫' },
  { key: 'mid', label: '年中檢討' },
  { key: 'end', label: '年終成果' },
]
const SWOT: [keyof AnnualPlan['swot'], string][] = [['s', '優勢 S'], ['w', '劣勢 W'], ['o', '機會 O'], ['t', '威脅 T']]
const BSC: [keyof AnnualPlan['bsc'], string][] = [['financial', '財務構面'], ['customer', '顧客構面'], ['process', '內部流程構面'], ['learning', '學習成長構面']]
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

/** 上年度 12 月底人力分布 */
function staffTable(d: EvalData, y: number) {
  const s = capacityRows(d, y)[11].staff
  return {
    headers: ['職別', '男', '女', '合計'],
    rows: [
      ['居家服務督導員', String(s.supM), String(s.supF), String(s.supM + s.supF)],
      ['照顧服務員', String(s.cgM), String(s.cgF), String(s.cgM + s.cgF)],
    ],
    foot: [['合計', String(s.supM + s.cgM), String(s.supF + s.cgF), String(s.supM + s.supF + s.cgM + s.cgF)]],
  }
}

const inRange = (a: PlanAction, m: number) => {
  const s = Number(a.start), e = Number(a.end || a.start)
  return !!s && m >= s && m <= e
}
const period = (a: PlanAction) => (a.start ? (a.end && a.end !== a.start ? `${a.start}～${a.end}月` : `${a.start}月`) : '')

function gantt(plan: AnnualPlan) {
  return {
    headers: ['目標／行動方案', ...MONTHS.map((m) => `${m}月`)],
    rows: plan.okrs.flatMap((o, i) =>
      o.actions.map((a) => [`O${i + 1} ${a.name || a.item}`, ...MONTHS.map((m) => (inRange(a, m) ? '■' : ''))]),
    ),
  }
}

const actionFilled = (a: PlanAction) => [a.name, a.item, a.indicator].some((s) => s.trim())
/** 匯出用：略過完全沒填的 OKR 與行動方案 */
function filledPlan(plan: AnnualPlan): AnnualPlan {
  return {
    ...plan,
    okrs: plan.okrs
      .map((o) => ({ ...o, actions: o.actions.filter(actionFilled) }))
      .filter((o) => o.objective.trim() || o.actions.length),
  }
}

function planDoc(d: EvalData, year: number, full: AnnualPlan, stage: Stage): DocBlock[] {
  const plan = filledPlan(full)
  const yl = yearLabel(year, d.org.yearFormat)
  const org = orgName(d)
  const okrHead = (o: Okr, i: number): DocBlock => ({ t: 'h', text: `（${cnNo(i)}）OKR${i + 1}：${o.objective}` })
  if (stage === 'start') {
    const prev = serviceTable(d, year - 1, false)
    return [
      { t: 'title', sub: org, text: `${yl}年度業務計畫` },
      { t: 'h', text: '一、前言' },
      { t: 'kv', pairs: [['願景', d.org.vision], ['理念', d.org.philosophy], ['使命', d.org.mission]] },
      { t: 'p', text: plan.intro },
      { t: 'h', text: '二、現況' },
      { t: 'p', text: `（一）${yearLabel(year - 1, d.org.yearFormat)}年度服務量` },
      { t: 'table', ...prev },
      { t: 'p', text: `（二）人力數分布（${yearLabel(year - 1, d.org.yearFormat)}年12月底）` },
      { t: 'table', ...staffTable(d, year - 1) },
      { t: 'p', text: '（三）SWOT 分析' },
      { t: 'table', headers: ['優勢 S', '劣勢 W'], rows: [[plan.swot.s, plan.swot.w]] },
      { t: 'table', headers: ['機會 O', '威脅 T'], rows: [[plan.swot.o, plan.swot.t]] },
      { t: 'p', text: '（四）平衡計分卡' },
      { t: 'table', headers: ['構面', '目標'], rows: BSC.map(([k, l]) => [l, plan.bsc[k]]) },
      { t: 'h', text: '三、年度目標（OKR）' },
      ...plan.okrs.flatMap((o, i): DocBlock[] => [
        okrHead(o, i),
        { t: 'table', headers: ['計畫', '執行項目', '量/質化指標', '執行期間'], rows: o.actions.map((a) => [a.name, a.item, a.indicator, period(a)]) },
      ]),
      { t: 'h', text: '四、計畫行事曆（甘特圖）' },
      { t: 'table', ...gantt(plan) },
    ]
  }
  const mid = stage === 'mid'
  return [
    { t: 'title', sub: org, text: `${yl}年度業務計畫${mid ? '年中檢討' : '期末成果'}` },
    ...(!mid
      ? ([
          { t: 'h', text: '一、機構現況' },
          { t: 'p', text: `${yl}年度服務量能及人力異動` },
          { t: 'table', ...serviceTable(d, year, true) },
        ] as DocBlock[])
      : []),
    { t: 'h', text: `${mid ? '一' : '二'}、年度計畫目標執行${mid ? '檢討' : '成果'}` },
    ...plan.okrs.flatMap((o, i): DocBlock[] => [
      okrHead(o, i),
      {
        t: 'table',
        headers: ['計畫', '執行項目', '量/質化指標', mid ? '執行成果' : '成果'],
        rows: o.actions.map((a) => [a.name, a.item, a.indicator, mid ? a.midResult : a.endResult]),
      },
      { t: 'box', label: '問題分析', text: mid ? o.midProblem : o.endProblem },
      { t: 'box', label: mid ? '修正計畫' : '改善方案', text: mid ? o.midRevise : o.endImprove },
    ]),
  ]
}

function DocTable({ headers, rows, foot }: { headers: string[]; rows: string[][]; foot?: string[][] }) {
  return (
    <div className="table-wrap">
      <table className="grid ro-table">
        <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        {foot && <tfoot>{foot.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tfoot>}
      </table>
    </div>
  )
}

function MonthSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="" />
      {MONTHS.map((m) => <option key={m} value={m}>{m}月</option>)}
    </select>
  )
}

export function AnnualPlanPage() {
  const { data, update } = useStore()
  const { year } = useYear()
  const [stage, setStage] = useState<Stage>('start')
  const f = data.org.yearFormat
  const yl = yearLabel(year, f)
  const prevYl = yearLabel(year - 1, f)
  const plan = data.plans[year] ?? emptyPlan()
  const set = (fn: (p: AnnualPlan) => void) => update((d) => { fn((d.plans[year] ??= emptyPlan())) })
  const setOkr = (i: number, fn: (o: Okr) => void) => set((p) => fn(p.okrs[i]))
  const setAction = (i: number, j: number, k: keyof Omit<PlanAction, 'id'>, v: string) => setOkr(i, (o) => { o.actions[j][k] = v })
  const stageLabel = STAGES.find((s) => s.key === stage)!.label

  const exportWord = () => exportDocx(`${yl}年度業務計畫_${stageLabel}`, planDoc(data, year, plan, stage))

  return (
    <Page
      title="年度業務計畫"
      actions={<>
        <YearSelect />
        <button type="button" className="btn" onClick={exportWord}>匯出 Word（{stageLabel}）</button>
      </>}
    >
      <div className="seg stage-tabs">
        {STAGES.map((s) => (
          <button type="button" key={s.key} className={stage === s.key ? 'on' : ''} onClick={() => setStage(s.key)}>{s.label}</button>
        ))}
      </div>

      {stage === 'start' && (
        <>
          <Card title="一、前言">
            <div className="readonly-box">
              <div><b>願景</b>{data.org.vision || <span className="help">（未填，請到首頁「機構設定」）</span>}</div>
              <div><b>理念</b>{data.org.philosophy || <span className="help">（未填）</span>}</div>
              <div><b>使命</b>{data.org.mission || <span className="help">（未填）</span>}</div>
            </div>
            <Field label="前言"><Area value={plan.intro} rows={4} onChange={(v) => set((p) => { p.intro = v })} /></Field>
          </Card>

          <Card title="二、現況">
            <h4>（一）{prevYl}年度服務量 <span className="help">由 1-2 服務量能自動帶入</span></h4>
            <DocTable {...serviceTable(data, year - 1, false)} />
            <h4>（二）人力數分布（{prevYl}年12月底）<span className="help">由員工名冊自動計算</span></h4>
            <DocTable {...staffTable(data, year - 1)} />
            <h4>（三）SWOT 分析</h4>
            <div className="grid2">
              {SWOT.map(([k, l]) => (
                <Field key={k} label={l}><Area value={plan.swot[k]} onChange={(v) => set((p) => { p.swot[k] = v })} /></Field>
              ))}
            </div>
            <h4>（四）平衡計分卡</h4>
            <div className="grid2">
              {BSC.map(([k, l]) => (
                <Field key={k} label={l}><Area value={plan.bsc[k]} rows={2} onChange={(v) => set((p) => { p.bsc[k] = v })} /></Field>
              ))}
            </div>
          </Card>

          <Card title="三、年度目標（OKR）" actions={<button type="button" className="btn small" onClick={() => set((p) => { p.okrs.push(emptyOkr()) })}>＋ 新增 OKR</button>}>
            {plan.okrs.map((o, i) => (
              <div key={o.id} className="topic">
                <div className="row between">
                  <b className="topic-no">OKR{i + 1}</b>
                  <div className="row">
                    <button type="button" className="icon" disabled={i === 0} title="上移" onClick={() => set((p) => { p.okrs = move(p.okrs, i, -1) })}>↑</button>
                    <button type="button" className="icon" disabled={i === plan.okrs.length - 1} title="下移" onClick={() => set((p) => { p.okrs = move(p.okrs, i, 1) })}>↓</button>
                    <button type="button" className="icon" title="刪除 OKR" onClick={() => {
                      if (window.confirm(`刪除 OKR${i + 1}（含其行動方案與年中、年終填寫內容）？`)) set((p) => { p.okrs.splice(i, 1) })
                    }}>✕</button>
                  </div>
                </div>
                <Field label="目標（O）"><Area value={o.objective} rows={1} onChange={(v) => setOkr(i, (x) => { x.objective = v })} /></Field>
                <div className="table-wrap">
                  <table className="grid">
                    <thead><tr><th className="no">#</th><th>計畫</th><th>執行項目</th><th>量/質化指標</th><th>起月</th><th>迄月</th><th /></tr></thead>
                    <tbody>
                      {o.actions.map((a, j) => (
                        <tr key={a.id}>
                          <td className="no">{j + 1}</td>
                          <td><textarea rows={2} value={a.name} onChange={(e) => setAction(i, j, 'name', e.target.value)} /></td>
                          <td><textarea rows={2} value={a.item} onChange={(e) => setAction(i, j, 'item', e.target.value)} /></td>
                          <td><textarea rows={2} value={a.indicator} onChange={(e) => setAction(i, j, 'indicator', e.target.value)} /></td>
                          <td style={{ width: '6em' }}><MonthSelect value={a.start} onChange={(v) => setAction(i, j, 'start', v)} /></td>
                          <td style={{ width: '6em' }}><MonthSelect value={a.end} onChange={(v) => setAction(i, j, 'end', v)} /></td>
                          <td className="ops"><button type="button" className="icon" title="刪除" onClick={() => setOkr(i, (x) => { x.actions.splice(j, 1) })}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div><button type="button" className="btn tiny ghost" onClick={() => setOkr(i, (x) => { x.actions.push(emptyAction()) })}>＋ 新增行動方案</button></div>
              </div>
            ))}
          </Card>

          <Card title="四、計畫行事曆（甘特圖）">
            <p className="help">依行動方案的起迄月份自動產生。</p>
            <div className="table-wrap">
              <table className="grid cal">
                <thead><tr><th>目標／行動方案</th>{MONTHS.map((m) => <th key={m} className="mcol">{m}月</th>)}</tr></thead>
                <tbody>
                  {plan.okrs.flatMap((o, i) =>
                    o.actions.map((a) => (
                      <tr key={a.id}>
                        <td>O{i + 1} {a.name || a.item}</td>
                        {MONTHS.map((m) => <td key={m} className={inRange(a, m) ? 'mcol bar' : 'mcol'} />)}
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {stage !== 'start' && (
        <>
          {stage === 'end' && (
            <Card title={`一、機構現況：${yl}年度服務量能及人力異動`}>
              <p className="help">由 1-2 服務量能與員工名冊自動產生。</p>
              <DocTable {...serviceTable(data, year, true)} />
            </Card>
          )}
          {plan.okrs.length === 0 && <div className="empty big">請先在「年初計畫」建立 OKR。</div>}
          {plan.okrs.map((o, i) => {
            const mid = stage === 'mid'
            return (
              <Card key={o.id} title={`OKR${i + 1}：${o.objective || '（未填目標）'}`}>
                <div className="table-wrap">
                  <table className="grid">
                    <thead><tr><th>計畫</th><th>執行項目</th><th>量/質化指標</th><th style={{ width: '40%' }}>{mid ? '執行成果' : '成果'}</th></tr></thead>
                    <tbody>
                      {o.actions.map((a, j) => (
                        <tr key={a.id}>
                          <td><span className="ro">{a.name}</span></td>
                          <td><span className="ro">{a.item}</span></td>
                          <td><span className="ro">{a.indicator}</span></td>
                          <td><textarea rows={2} value={mid ? a.midResult : a.endResult} onChange={(e) => setAction(i, j, mid ? 'midResult' : 'endResult', e.target.value)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid2">
                  <Field label="問題分析">
                    <Area value={mid ? o.midProblem : o.endProblem} onChange={(v) => setOkr(i, (x) => { if (mid) x.midProblem = v; else x.endProblem = v })} />
                  </Field>
                  <Field label={mid ? '修正計畫' : '改善方案'}>
                    <Area value={mid ? o.midRevise : o.endImprove} onChange={(v) => setOkr(i, (x) => { if (mid) x.midRevise = v; else x.endImprove = v })} />
                  </Field>
                </div>
              </Card>
            )
          })}
        </>
      )}
    </Page>
  )
}
