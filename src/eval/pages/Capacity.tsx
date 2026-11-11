import { capacityRows, fmtNum, sumAvg, toNum, yearLabel } from '../fmt'
import { exportXlsx } from '../exportXlsx'
import { emptyCapacity, useStore } from '../store'
import type { CapacityMonth, EvalData, StaffCountKey } from '../types'
import { Card, orgName, Page, StaffWarnings, useYear, YearSelect } from '../ui'

export const STAFF_COLS: { key: StaffCountKey; label: string }[] = [
  { key: 'supM', label: '居督 男' },
  { key: 'supF', label: '居督 女' },
  { key: 'cgM', label: '照服員 男' },
  { key: 'cgF', label: '照服員 女' },
  { key: 'supNew', label: '新進居督' },
  { key: 'supLeave', label: '離職居督' },
  { key: 'cgNew', label: '新進照服員' },
  { key: 'cgLeave', label: '離職照服員' },
]
const FLOW: StaffCountKey[] = ['supNew', 'supLeave', 'cgNew', 'cgLeave']

/** 1～12 月服務量＋總計、平均（年初「現況」、年終「機構現況」共用）；新進／離職只列總計 */
export function serviceTable(d: EvalData, y: number, withStaffFlow: boolean) {
  const rows = capacityRows(d, y)
  const headers = ['月', '案管個案數', '申報人數', '申報金額', ...(withStaffFlow ? ['新進居督', '離職居督', '新進照服員', '離職照服員'] : [])]
  const body = rows.map((r) => [
    `${r.month}月`, r.cases, r.claimants, r.amount ? fmtNum(toNum(r.amount)) : '',
    ...(withStaffFlow ? FLOW.map((k) => r.shown[k]) : []),
  ])
  const s = (k: 'cases' | 'claimants' | 'amount') => sumAvg(rows.map((r) => r[k]))
  const flow = (k: StaffCountKey) => rows.reduce((a, r) => a + r.staff[k], 0)
  const foot = [
    ['總計', fmtNum(s('cases').sum), fmtNum(s('claimants').sum), fmtNum(s('amount').sum), ...(withStaffFlow ? FLOW.map((k) => String(flow(k))) : [])],
    ['平均', fmtNum(s('cases').avg, 1), fmtNum(s('claimants').avg, 1), fmtNum(s('amount').avg, 0), ...(withStaffFlow ? FLOW.map(() => '') : [])],
  ]
  return { headers, rows: body, foot }
}

export function CapacityPage() {
  const { data, update } = useStore()
  const { year } = useYear()
  const yl = yearLabel(year, data.org.yearFormat)
  const rows = capacityRows(data, year)

  const set = (i: number, fn: (m: CapacityMonth) => void) =>
    update((d) => {
      const list = (d.capacity[year] ??= emptyCapacity())
      fn(list[i])
    })

  const exportIt = () =>
    exportXlsx(`${yl}年度服務量能`, {
      org: orgName(data),
      title: `${yl}年度服務量能`,
      cols: [
        { label: '年', width: 7 }, { label: '月', width: 6 }, { label: '案管個案數(含服務中、暫停服務)', width: 16 },
        { label: '申報人數', width: 10 }, { label: '申報金額', width: 14 },
        { label: '員工人數', children: [{ label: '居督 男', width: 9 }, { label: '居督 女', width: 9 }, { label: '照服員 男', width: 10 }, { label: '照服員 女', width: 10 }] },
        { label: '人力異動', children: [{ label: '新進居督', width: 9 }, { label: '離職居督', width: 9 }, { label: '新進照服員', width: 10 }, { label: '離職照服員', width: 10 }] },
      ],
      rows: rows.map((r) => [
        yl, r.month, r.cases, r.claimants, r.amount,
        ...STAFF_COLS.map((c) => (r.shown[c.key] === '' ? '' : r.staff[c.key])),
      ]),
    })

  const s = (k: 'cases' | 'claimants' | 'amount') => sumAvg(rows.map((r) => r[k]))

  return (
    <Page title="服務量能" actions={<><YearSelect /><button type="button" className="btn" onClick={exportIt}>匯出 Excel</button></>}>
      <StaffWarnings link />
      <Card title={`${yl}年度每月服務量能`}>
        <p className="help">
          個案數、申報人數、申報金額手動填。人數由員工名冊自動計算（月底在職人數、當月到職／離職人數），可以直接改；
          手動改過的格子會以底色標示，清空就恢復自動計算。還沒到的月份不會自動帶人數。
        </p>
        <div className="table-wrap">
          <table className="grid capacity">
            <thead>
              <tr>
                <th className="no">月</th>
                <th>案管個案數<br /><span className="help">含服務中、暫停服務</span></th>
                <th>申報人數</th>
                <th>申報金額</th>
                {STAFF_COLS.map((c) => <th key={c.key}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.month}>
                  <td className="no">{r.month}</td>
                  {(['cases', 'claimants', 'amount'] as const).map((k) => (
                    <td key={k}><input inputMode="numeric" value={r[k]} onChange={(e) => set(i, (m) => { m[k] = e.target.value })} /></td>
                  ))}
                  {STAFF_COLS.map((c) => (
                    <td key={c.key}>
                      <input
                        inputMode="numeric"
                        className={r.manual[c.key] ? 'manual' : ''}
                        title={r.manual[c.key] ? `手動修改（自動計算為 ${r.future ? '—' : r.auto[c.key]}），清空可恢復自動` : '由員工名冊自動計算'}
                        value={r.manual[c.key] ? (data.capacity[year]?.[i]?.override?.[c.key] ?? '') : r.shown[c.key]}
                        onChange={(e) => {
                          const v = e.target.value.trim()
                          // 清空或改回自動值＝取消手動覆寫
                          const next = v === '' || (!r.future && v === String(r.auto[c.key])) ? '' : v
                          set(i, (m) => { m.override = { ...m.override, [c.key]: next } })
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="no">總計</td>
                <td>{fmtNum(s('cases').sum)}</td><td>{fmtNum(s('claimants').sum)}</td><td>{fmtNum(s('amount').sum)}</td>
                {STAFF_COLS.map((c) => <td key={c.key}>{FLOW.includes(c.key) ? rows.reduce((a, r) => a + r.staff[c.key], 0) : ''}</td>)}
              </tr>
              <tr>
                <td className="no">平均</td>
                <td>{fmtNum(s('cases').avg, 1)}</td><td>{fmtNum(s('claimants').avg, 1)}</td><td>{fmtNum(s('amount').avg)}</td>
                {STAFF_COLS.map((c) => <td key={c.key} />)}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </Page>
  )
}
