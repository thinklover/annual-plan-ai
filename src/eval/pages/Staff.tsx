import { useState } from 'react'
import {
  activeInYear, activeOn, cprStatus, fmtDate, fmtNum, isCaregiver, isSupervisor, round2, thisYear, todayIso, toNum, yearLabel,
} from '../fmt'
import { exportXlsx } from '../exportXlsx'
import { emptyEmployeeYear, renameEverywhere, uid, useStore } from '../store'
import { HOUR_KEYS, HOUR_LABELS, type Employee, type EmployeeYear, type HourKey } from '../types'
import { Card, confirmDelete, DateIn, Field, OptionSelect, orgName, Page, StaffWarnings, Text, useYear, YearSelect } from '../ui'

const newEmployee = (): Employee => ({
  id: uid(), name: '', gender: '', title: '', cardRole: '', hireDate: '', leaveDate: '', hireCheckDate: '',
  dementiaCert: '', disabilityCert: '', footCare: '', ba17: '', cprExpiry: '', yearly: {}, draft: true,
})

type BasicKey = Exclude<keyof Employee, 'id' | 'yearly' | 'draft'>
const MODAL_FIELDS: { key: BasicKey; label: string; kind?: 'date' | 'gender' | 'title' | 'cardRole' }[] = [
  { key: 'name', label: '姓名' },
  { key: 'gender', label: '性別', kind: 'gender' },
  { key: 'title', label: '職稱', kind: 'title' },
  { key: 'cardRole', label: '長照小卡職別', kind: 'cardRole' },
  { key: 'hireDate', label: '到職日', kind: 'date' },
  { key: 'leaveDate', label: '離職日', kind: 'date' },
  { key: 'hireCheckDate', label: '到職體格檢查日期', kind: 'date' },
  { key: 'cprExpiry', label: 'CPR 有效日期', kind: 'date' },
  { key: 'dementiaCert', label: '失智症基礎訓練證號' },
  { key: 'disabilityCert', label: '身心障礙服務訓練證號' },
  { key: 'footCare', label: '足部照護課程證號' },
  { key: 'ba17', label: 'BA17 特殊課程證號' },
]

function EmployeeModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, update } = useStore()
  const e = data.employees.find((x) => x.id === id)
  // 開啟時的姓名：關閉時若改了名字，同步更新所有紀錄
  const [origName] = useState(() => e?.name ?? '')
  if (!e) return null
  const set = (k: BasicKey, v: string) =>
    update((d) => {
      const x = d.employees.find((y) => y.id === id)
      if (x) (x[k] as string) = v
    })
  const remove = () => update((d) => { d.employees = d.employees.filter((x) => x.id !== id) })

  const close = () => {
    const name = e.name.trim()
    if (!name) {
      const blank = MODAL_FIELDS.every((f) => !e[f.key])
      if (!blank && !window.confirm('尚未填寫姓名，關閉會捨棄這筆員工資料。確定嗎？')) return
      remove()
      return onClose()
    }
    update((d) => {
      const x = d.employees.find((y) => y.id === id)
      if (!x) return
      x.name = name
      delete x.draft
      const othersUseOld = d.employees.some((y) => y.id !== id && y.name === origName)
      if (origName && origName !== name && !othersUseOld) renameEverywhere(d, origName, name)
    })
    onClose()
  }

  return (
    <div className="modal-bg" onClick={close}>
      <div className="modal staff-modal" onClick={(ev) => ev.stopPropagation()}>
        <h3>{e.draft ? '新增員工' : `編輯員工：${origName}`}</h3>
        <div className="grid2">
          {MODAL_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.kind === 'gender' ? (
                <select value={e.gender} onChange={(ev) => set('gender', ev.target.value)}>
                  <option value="">請選擇</option><option>男</option><option>女</option>
                </select>
              ) : f.kind === 'title' || f.kind === 'cardRole' ? (
                <OptionSelect optKey={f.kind} value={e[f.key]} onChange={(v) => set(f.key, v)} />
              ) : f.kind === 'date' ? (
                <DateIn value={e[f.key]} onChange={(v) => set(f.key, v)} />
              ) : (
                <Text value={e[f.key]} onChange={(v) => set(f.key, v)} />
              )}
            </Field>
          ))}
        </div>
        <p className="help">居督／照服員依「長照小卡職別」分類。離職請填離職日，不要刪除。改名會同步更新會議、個督等紀錄裡的姓名。</p>
        <div className="row between">
          {e.draft ? <span /> : (
            <button type="button" className="btn danger ghost" onClick={() => {
              if (!confirmDelete(`員工「${e.name || '未命名'}」`)) return
              remove()
              onClose()
            }}>刪除員工</button>
          )}
          <div className="row">
            <span className="help">自動儲存</span>
            <button type="button" className="btn primary" onClick={close}>完成</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StaffPage() {
  const { data, update } = useStore()
  const { year } = useYear()
  const [editing, setEditing] = useState<string | null>(null)
  const f = data.org.yearFormat
  const yl = yearLabel(year, f)
  const emps = data.employees
  const yearEmps = emps.filter((e) => activeInYear(e, year))

  const setYearly = (id: string, fn: (y: EmployeeYear) => void) =>
    update((d) => {
      const e = d.employees.find((x) => x.id === id)
      if (!e) return
      const y = (e.yearly[year] ??= emptyEmployeeYear())
      fn(y)
    })
  const yearlyOf = (e: Employee) => e.yearly[year] ?? emptyEmployeeYear()
  const total = (e: Employee) => round2(HOUR_KEYS.reduce((s, k) => s + toNum(yearlyOf(e).hours[k]), 0))

  /** 統計日期：今年用今天，過去年度用年底 */
  const statDate = year >= thisYear() ? todayIso() : `${year}-12-31`
  const remark = (e: Employee) => (e.leaveDate && e.leaveDate <= `${year}-12-31` ? '離職' : '')
  const org = orgName(data)

  const add = () => {
    const e = newEmployee()
    update((d) => { d.employees.push(e) })
    setEditing(e.id)
  }

  const flags = (e: Employee) => {
    const out: { text: string; cls: string }[] = []
    if (e.leaveDate) out.push({ text: '離職', cls: 'muted' })
    if (!e.hireDate) out.push({ text: '未填到職日', cls: 'warn' })
    if (!e.gender) out.push({ text: '未填性別', cls: 'warn' })
    if (!isSupervisor(e) && !isCaregiver(e)) out.push({ text: '職別未分類', cls: 'warn' })
    if (!e.leaveDate) {
      const c = cprStatus(e, todayIso())
      if (c === 'expired') out.push({ text: 'CPR 已過期', cls: 'danger' })
      if (c === 'soon') out.push({ text: 'CPR 即將到期', cls: 'warn' })
    }
    return out
  }

  const exports = [
    {
      label: '新進人員體格檢查總表',
      run: () => {
        const list = emps.filter((e) => e.hireDate.startsWith(String(year))).sort((a, b) => a.hireDate.localeCompare(b.hireDate))
        return exportXlsx(`${yl}年新進人員體格檢查總表`, {
          org, title: `${yl}年新進人員名冊`,
          cols: [{ label: '序號', width: 7 }, { label: '姓名' }, { label: '性別', width: 7 }, { label: '到職日' }, { label: '體檢日期' }, { label: '備註' }],
          rows: list.map((e, i) => [i + 1, e.name, e.gender, fmtDate(e.hireDate, f), fmtDate(e.hireCheckDate, f), remark(e)]),
        })
      },
    },
    {
      label: '特殊訓練課程總表',
      run: () => {
        const list = emps.filter((e) => activeOn(e, statDate))
        return exportXlsx(`${yl}年特殊訓練課程總表`, {
          org, title: `${yl}年在職員工名冊`,
          cols: [
            { label: '編號', width: 7 }, { label: '姓名', width: 10 }, { label: '職稱' }, { label: '到職日', width: 12 },
            { label: '長照小卡', children: [{ label: '職別' }] },
            { label: '特殊訓練', children: [{ label: '身心障礙服務訓練' }, { label: '失智症訓練課程' }, { label: '足部照護課程' }, { label: 'BA17特殊課程' }] },
            { label: 'CPR或CPCR或BLS訓練', children: [{ label: '有', width: 6 }, { label: '無', width: 6 }, { label: '到期日', width: 12 }] },
          ],
          rows: list.map((e, i) => {
            // 有效＝有到期日且統計日尚未過期
            const valid = !!e.cprExpiry && e.cprExpiry >= statDate
            return [
              i + 1, e.name, e.title, fmtDate(e.hireDate, f), e.cardRole, e.disabilityCert, e.dementiaCert, e.footCare, e.ba17,
              valid ? 'V' : '', valid ? '' : 'V', fmtDate(e.cprExpiry, f),
            ]
          }),
          note: `統計至${fmtDate(statDate, f)}`,
        })
      },
    },
    {
      label: '員工在職體檢總表',
      run: () =>
        exportXlsx(`${yl}年度員工在職體檢總表`, {
          org, title: `${yl}年度在職員工健康體檢名冊`,
          cols: [{ label: '序號', width: 7 }, { label: '姓名' }, { label: '性別', width: 7 }, { label: '到職日' }, { label: '體檢日期' }, { label: '備註' }],
          rows: yearEmps.map((e, i) => [i + 1, e.name, e.gender, fmtDate(e.hireDate, f), fmtDate(yearlyOf(e).healthCheck, f), remark(e)]),
        }),
    },
    {
      label: '教育訓練統計總表',
      run: () =>
        exportXlsx(`${yl}年度在職員工訓練統計總表`, {
          org, title: `${yl}年度在職員工訓練統計總表`,
          cols: [
            { label: '編號', width: 7 }, { label: '姓名', width: 10 }, { label: '職稱' }, { label: '到職日', width: 12 },
            { label: '課程屬性', children: (['pro', 'quality', 'ethics', 'law'] as HourKey[]).map((k) => ({ label: HOUR_LABELS[k], width: 10 })) },
            { label: '原住民族文化敏感度及能力', width: 16 }, { label: '多元族群文化敏感度及能力', width: 16 }, { label: '總計', width: 10 },
          ],
          rows: yearEmps.map((e, i) => [
            i + 1, e.name, e.title, fmtDate(e.hireDate, f), ...HOUR_KEYS.map((k) => toNum(yearlyOf(e).hours[k])), total(e),
          ]),
          note: `${fmtDate(statDate, f)}統計截止`,
        }),
    },
  ]

  return (
    <Page no="1-1" title="基本資料建置與連動（員工名冊）" actions={<YearSelect />}>
      <StaffWarnings />
      <Card title="員工名冊" actions={<button type="button" className="btn small" onClick={add}>＋ 新增員工</button>}>
        <p className="help">點一列可編輯完整資料（體檢、特殊訓練證號等）。基本資料跨年度共用。</p>
        <div className="table-wrap">
          <table className="grid records">
            <thead>
              <tr>
                <th className="no">#</th><th>姓名</th><th>性別</th><th>職稱</th><th>長照小卡職別</th>
                <th>到職日</th><th>離職日</th><th>CPR 有效日期</th><th>提醒</th><th />
              </tr>
            </thead>
            <tbody>
              {emps.length === 0 && <tr><td colSpan={10} className="empty">還沒有員工，按「新增員工」開始。</td></tr>}
              {emps.map((e, i) => (
                <tr key={e.id} className={e.leaveDate ? 'left' : ''} onClick={() => setEditing(e.id)}>
                  <td className="no">{i + 1}</td>
                  <td><b>{e.name || '（未填姓名）'}</b></td>
                  <td>{e.gender}</td>
                  <td>{e.title}</td>
                  <td>{e.cardRole}</td>
                  <td>{fmtDate(e.hireDate, f)}</td>
                  <td>{fmtDate(e.leaveDate, f)}</td>
                  <td>{fmtDate(e.cprExpiry, f)}</td>
                  <td><span className="chips">{flags(e).map((x) => <span key={x.text} className={`chip ${x.cls}`}>{x.text}</span>)}</span></td>
                  <td className="ops"><button type="button" className="link">編輯</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`${yl}年度資料：年度健檢與在職訓練時數`}>
        <p className="help">列出本年度曾在職的員工。訓練時數填全年度各類總時數（小時）。</p>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th className="no">#</th><th>姓名</th><th>年度健康檢查日期</th>
                {HOUR_KEYS.map((k) => <th key={k}>{HOUR_LABELS[k]}</th>)}
                <th>總計</th>
              </tr>
            </thead>
            <tbody>
              {yearEmps.length === 0 && <tr><td colSpan={HOUR_KEYS.length + 4} className="empty">本年度沒有在職員工（請確認員工名冊的到職日）。</td></tr>}
              {yearEmps.map((e, i) => (
                <tr key={e.id}>
                  <td className="no">{i + 1}</td>
                  <td><span className="ro">{e.name}{remark(e) && <span className="chip muted">離職</span>}</span></td>
                  <td><input type="date" value={yearlyOf(e).healthCheck} onChange={(ev) => setYearly(e.id, (y) => { y.healthCheck = ev.target.value })} /></td>
                  {HOUR_KEYS.map((k) => (
                    <td key={k} style={{ minWidth: '6em' }}>
                      <input inputMode="decimal" value={yearlyOf(e).hours[k]} onChange={(ev) => setYearly(e.id, (y) => { y.hours[k] = ev.target.value })} />
                    </td>
                  ))}
                  <td><span className="ro">{fmtNum(total(e), 2)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`${yl}年度總表匯出（Excel）`}>
        <div className="row">
          {exports.map((x, i) => (
            <button key={x.label} type="button" className="btn ghost" onClick={() => x.run()}>{i + 1}. {x.label}</button>
          ))}
        </div>
        <p className="help">特殊訓練課程總表列出統計日（今年為今天、過去年度為年底）在職的員工；CPR 到期日已過的列為「無」。</p>
      </Card>

      {editing && <EmployeeModal key={editing} id={editing} onClose={() => setEditing(null)} />}
    </Page>
  )
}
