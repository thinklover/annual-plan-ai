import { useState } from 'react'
import { generate, parseJson } from '../../gemini'
import { getSettings } from '../../storage'
import { capacityRows, fmtDate, yearLabel } from '../fmt'
import { exportDocx, type DocBlock } from '../exportDocx'
import { emptyAction, emptyOkr, emptyPlan, useStore } from '../store'
import type { AnnualPlan, EvalData, Okr, PlanAction } from '../types'
import { AiKeyHint, Area, Card, Field, move, NO_SUGGEST, orgName, Page, Tip, useAi, useYear, YearSelect } from '../ui'
import { serviceTable } from './Capacity'
import { cnNo } from './Meetings'

type Stage = 'start' | 'mid' | 'end'
const STAGES: { key: Stage; label: string }[] = [
  { key: 'start', label: '年初計畫' },
  { key: 'mid', label: '年中檢討' },
  { key: 'end', label: '年終成果' },
]
const SWOT: [keyof AnnualPlan['swot'], string, string][] = [
  ['s', '優勢 S', '機構內部做得好的地方，例如人力穩定、專業訓練完整、服務口碑佳'],
  ['w', '劣勢 W', '機構內部較不足的地方，例如人力不足、行政流程未資訊化'],
  ['o', '機會 O', '外部環境有利的條件，例如政策補助、在地需求增加、可合作的社區資源'],
  ['t', '威脅 T', '外部環境不利的條件，例如同業競爭、法規變動、人力市場短缺'],
]
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

const krsOf = (o: Okr) => o.krs.map((k) => k.trim()).filter(Boolean)
const krText = (o: Okr) => krsOf(o).map((k, i) => `KR${i + 1}：${k}`).join('\n')

/** 給 AI 的機構背景：基本資料、前一年度服務量與人力、SWOT */
function orgContext(d: EvalData, year: number, plan: AnnualPlan) {
  const f = d.org.yearFormat
  const o = d.org
  const table = (y: number, flow: boolean) => {
    const t = serviceTable(d, y, flow)
    return [t.headers.join('｜'), ...t.rows.filter((r) => r.slice(1).some(Boolean)).map((r) => r.join('｜')), ...t.foot.map((r) => r.join('｜'))].join('\n')
  }
  const st = staffTable(d, year - 1)
  return {
    org: [
      '# 機構基本資料',
      `機構：${o.name}；設立日期：${fmtDate(o.foundedDate, f)}；地址：${o.address}`,
      `願景：${o.vision}`, `理念：${o.philosophy}`, `使命：${o.mission}`,
    ].join('\n'),
    prev: [
      `# ${yearLabel(year - 1, f)}年度服務量`, table(year - 1, false),
      `# ${yearLabel(year - 1, f)}年12月底人力`, ...[...st.rows, ...st.foot].map((r) => `${r[0]}：男 ${r[1]}、女 ${r[2]}、合計 ${r[3]}`),
    ].join('\n'),
    current: [`# ${yearLabel(year, f)}年度服務量能及人力異動`, table(year, true)].join('\n'),
    swot: ['# SWOT 分析', ...SWOT.map(([k, l]) => `${l}：${plan.swot[k] || '（未填）'}`)].join('\n'),
  }
}

const AI_BASE = '你是台灣長照居家服務機構的經營管理顧問，協助機構撰寫評鑑用的年度業務計畫。使用繁體中文、台灣長照用語與正式書面語氣；只根據提供的資料撰寫，不要捏造資料中沒有的數字或事實。只輸出 JSON。'

const actionFilled = (a: PlanAction) => [a.name, a.item, a.indicator].some((s) => s.trim())
/** 匯出用：略過完全沒填的 OKR 與行動方案 */
function filledPlan(plan: AnnualPlan): AnnualPlan {
  return {
    ...plan,
    okrs: plan.okrs
      .map((o) => ({ ...o, actions: o.actions.filter(actionFilled) }))
      .filter((o) => o.objective.trim() || krsOf(o).length || o.actions.length),
  }
}

function planDoc(d: EvalData, year: number, full: AnnualPlan, stage: Stage): DocBlock[] {
  const plan = filledPlan(full)
  const yl = yearLabel(year, d.org.yearFormat)
  const org = orgName(d)
  const okrHead = (o: Okr, i: number): DocBlock => ({ t: 'h', text: `（${cnNo(i)}）OKR${i + 1}：${o.objective}` })
  const krBlock = (o: Okr): DocBlock[] => (krsOf(o).length ? [{ t: 'box', label: '關鍵結果（KR）', text: krText(o) }] : [])
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
      // 平衡計分卡選填：全部沒填就不印
      ...(BSC.some(([k]) => plan.bsc[k].trim())
        ? ([
            { t: 'p', text: '（四）平衡計分卡' },
            { t: 'table', headers: ['構面', '分析與目標'], rows: BSC.filter(([k]) => plan.bsc[k].trim()).map(([k, l]) => [l, plan.bsc[k]]) },
          ] as DocBlock[])
        : []),
      { t: 'h', text: '三、年度目標（OKR）' },
      ...plan.okrs.flatMap((o, i): DocBlock[] => [
        okrHead(o, i),
        ...krBlock(o),
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
          ...(plan.endNarrative.trim() ? [{ t: 'p', text: plan.endNarrative }] : []),
        ] as DocBlock[])
      : []),
    { t: 'h', text: `${mid ? '一' : '二'}、年度計畫目標執行${mid ? '檢討' : '成果'}` },
    ...plan.okrs.flatMap((o, i): DocBlock[] => [
      okrHead(o, i),
      ...krBlock(o),
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

  const ai = useAi()
  const [aiTarget, setAiTarget] = useState('')
  const runAi = (target: string, fn: () => Promise<void>) => {
    setAiTarget(target)
    return ai.run(fn)
  }
  const ctx = () => orgContext(data, year, plan)
  const aiErr = (target: string) => (ai.err && aiTarget === target ? <div className="err">{ai.err}</div> : null)
  const aiBusy = (target: string) => ai.busy && aiTarget === target

  const aiBsc = () => {
    if (BSC.some(([k]) => plan.bsc[k].trim()) && !window.confirm('AI 分析會覆蓋目前平衡計分卡四個構面的內容，確定嗎？')) return
    runAi('bsc', async () => {
      const c = ctx()
      const out = parseJson<Partial<AnnualPlan['bsc']>>(await generate(
        getSettings(),
        `${AI_BASE}\n請依機構基本資料、前一年度服務量與人力、SWOT 分析，評估機構在平衡計分卡四個構面的現況，並各提出 2～3 項可衡量的年度目標。每個構面先用一兩句說明現況，再條列目標（「1. 」「2. 」編號，每項一行）。資料不足以判斷的構面，請依現有資料保守撰寫並註明「待補充資料」。\n輸出格式：{"financial": "…", "customer": "…", "process": "…", "learning": "…"}`,
        [c.org, c.prev, c.swot].join('\n\n'),
      ))
      set((p) => { for (const [k] of BSC) p.bsc[k] = String(out[k] ?? '').trim() })
    })
  }

  const aiActions = (i: number) => {
    const o = plan.okrs[i]
    if (!o.objective.trim() && !krsOf(o).length) {
      setAiTarget(`okr-${o.id}`)
      return ai.setErr('請先填寫目標（O）與關鍵結果（KR），AI 才能提出行動方案。')
    }
    if (o.actions.some(actionFilled) && !window.confirm(`AI 會以新的行動方案取代 OKR${i + 1} 目前的行動方案，確定嗎？`)) return
    runAi(`okr-${o.id}`, async () => {
      const c = ctx()
      const out = parseJson<{ actions?: Partial<PlanAction>[] }>(await generate(
        getSettings(),
        `${AI_BASE}\n請依年度目標（O）與關鍵結果（KR），提出 3～5 個具體可行的行動方案，每個關鍵結果至少對應一個。欄位：name＝計畫名稱（簡短）、item＝執行項目（誰、做什麼、頻率）、indicator＝量/質化指標（可衡量，並對應關鍵結果）、start／end＝執行起訖月份（1～12 的數字字串）。\n輸出格式：{"actions": [{"name": "…", "item": "…", "indicator": "…", "start": "1", "end": "12"}]}`,
        [c.org, c.prev, c.swot, `# ${yl}年度 OKR${i + 1}`, `目標（O）：${o.objective}`, krText(o) || '關鍵結果：（未填）'].join('\n\n'),
      ))
      const month = (v: unknown) => {
        const n = Number(v)
        return Number.isInteger(n) && n >= 1 && n <= 12 ? String(n) : ''
      }
      const list = (out.actions ?? []).map((a) => ({
        ...emptyAction(), name: String(a.name ?? '').trim(), item: String(a.item ?? '').trim(), indicator: String(a.indicator ?? '').trim(),
        start: month(a.start), end: month(a.end),
      })).filter(actionFilled)
      if (!list.length) throw new Error('AI 沒有提出行動方案，請補充目標與關鍵結果後再試一次。')
      setOkr(i, (x) => { x.actions = list })
    })
  }

  const aiNarrative = () => {
    if (plan.endNarrative.trim() && !window.confirm('AI 會覆蓋目前的文字敘述，確定嗎？')) return
    runAi('narrative', async () => {
      const c = ctx()
      const out = parseJson<{ text?: string }>(await generate(
        getSettings(),
        `${AI_BASE}\n請依本年度每月服務量能與人力異動的表格數據，撰寫 150～250 字的文字敘述，說明這一年組織量能的發展情形：個案數、申報人數與申報金額的變化趨勢（引用表中的實際數字）、人力新進與離職情形，以及對服務量能的影響。還沒有數據的月份不要推測。分 1～2 段，不要條列。\n輸出格式：{"text": "…"}`,
        [c.org, c.current].join('\n\n'),
      ))
      set((p) => { p.endNarrative = String(out.text ?? '').trim() })
    })
  }

  const exportWord = () => exportDocx(`${yl}年度業務計畫_${stageLabel}`, planDoc(data, year, plan, stage))

  return (
    <Page
      title="年度業務計畫"
      submit
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
            <h4>（一）{prevYl}年度服務量<Tip>由 1-2 服務量能自動帶入。</Tip></h4>
            <DocTable {...serviceTable(data, year - 1, false)} />
            <h4>（二）人力數分布（{prevYl}年12月底）<Tip>由員工名冊自動計算。</Tip></h4>
            <DocTable {...staffTable(data, year - 1)} />
            <h4>（三）SWOT 分析</h4>
            <div className="grid2">
              {SWOT.map(([k, l, hint]) => (
                <Field key={k} label={l}><Area value={plan.swot[k]} placeholder={hint} onChange={(v) => set((p) => { p.swot[k] = v })} /></Field>
              ))}
            </div>
            <div className="row between">
              <h4>
                （四）平衡計分卡
                <Tip>
                  選填，沒填的構面不會印在 Word。按「AI 分析」，由 AI 依機構基本資料、{prevYl}年度服務量與人力、SWOT，評估四個構面並提出目標，填入後可直接修改。
                </Tip>
              </h4>
              <button type="button" className="btn small" disabled={ai.busy} onClick={aiBsc}>{aiBusy('bsc') ? 'AI 分析中…' : 'AI 分析'}</button>
            </div>
            <div className="help"><AiKeyHint /></div>
            {aiErr('bsc')}
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
                <Field label="關鍵結果（KR）" help="用可衡量的結果說明「怎樣算達成目標」，建議 2 個。">
                  <div className="kr-list">
                    {o.krs.map((k, j) => (
                      <div key={j} className="row">
                        <b>KR{j + 1}</b>
                        <input value={k} {...NO_SUGGEST} placeholder="例如：服務滿意度達 90% 以上" onChange={(e) => setOkr(i, (x) => { x.krs[j] = e.target.value })} />
                        {o.krs.length > 2 && <button type="button" className="icon" title="刪除這個關鍵結果" onClick={() => setOkr(i, (x) => { x.krs.splice(j, 1) })}>✕</button>}
                      </div>
                    ))}
                    {o.krs.length < 5 && <div><button type="button" className="btn tiny ghost" onClick={() => setOkr(i, (x) => { x.krs.push('') })}>＋ 新增關鍵結果</button></div>}
                  </div>
                </Field>
                <div className="row between">
                  <b>行動方案</b>
                  <button type="button" className="btn small" disabled={ai.busy} onClick={() => aiActions(i)}>{aiBusy(`okr-${o.id}`) ? 'AI 規劃中…' : 'AI 依關鍵結果提供行動方案'}</button>
                </div>
                {aiErr(`okr-${o.id}`)}
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

          <Card title="四、計畫行事曆（甘特圖）" tip="依行動方案的起迄月份自動產生。">
            <div className="table-wrap">
              <table className="grid cal">
                <thead><tr><th>目標／行動方案</th>{MONTHS.map((m) => <th key={m} className="mcol">{m}月</th>)}</tr></thead>
                <tbody>
                  {plan.okrs.flatMap((o, i) =>
                    o.actions.map((a) => (
                      <tr key={a.id}>
                        <td className="long">O{i + 1} {a.name || a.item}</td>
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
            <Card
              title={`一、機構現況：${yl}年度服務量能及人力異動`}
              tip="由 1-2 服務量能與員工名冊自動產生。"
              actions={<button type="button" className="btn small" disabled={ai.busy} onClick={aiNarrative}>{aiBusy('narrative') ? 'AI 撰寫中…' : 'AI 撰寫敘述'}</button>}
            >
              <DocTable {...serviceTable(data, year, true)} />
              <Field label="組織量能發展情形（文字敘述）" help="說明這一年個案數、申報量與人力的變化。可按「AI 撰寫敘述」由 AI 依上表數據起草，再自行修改；會印在 Word 的表格下方。">
                <Area value={plan.endNarrative} rows={4} onChange={(v) => set((p) => { p.endNarrative = v })} />
              </Field>
              {aiErr('narrative')}
            </Card>
          )}
          {plan.okrs.length === 0 && <div className="empty big">請先在「年初計畫」建立 OKR。</div>}
          {plan.okrs.map((o, i) => {
            const mid = stage === 'mid'
            return (
              <Card key={o.id} title={`OKR${i + 1}：${o.objective || '（未填目標）'}`}>
                {krsOf(o).length > 0 && <div className="readonly-box kr-box">{krsOf(o).map((k, j) => <div key={j}><b>KR{j + 1}</b>{k}</div>)}</div>}
                {!o.actions.some(actionFilled) && <div className="notice">這個 OKR 在「年初計畫」還沒有填行動方案，請先回年初計畫補上，這裡才會帶出要檢視的項目。</div>}
                <div className="table-wrap">
                  <table className="grid">
                    <thead><tr><th>計畫</th><th>執行項目</th><th>量/質化指標</th><th>執行期間</th><th style={{ width: '36%' }}>{mid ? '執行成果（進度）' : '成果'}</th></tr></thead>
                    <tbody>
                      {o.actions.map((a, j) => (
                        <tr key={a.id}>
                          <td className="long"><span className="ro">{a.name}</span></td>
                          <td className="long"><span className="ro">{a.item}</span></td>
                          <td className="long"><span className="ro">{a.indicator}</span></td>
                          <td style={{ width: '6em' }}><span className="ro">{period(a)}</span></td>
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
