import { useRef, useState } from 'react'
import {
  activeInYear, activeOn, cprStatus, fmtDate, fmtNum, isCaregiver, isSupervisor, round2, thisYear, todayIso, toNum, yearLabel,
} from '../fmt'
import { exportXlsx } from '../exportXlsx'
import { applyStaffImport, downloadStaffTemplate, parseStaffXlsx } from '../importStaff'
import { emptyEmployeeYear, renameEverywhere, uid, useStore } from '../store'
import { HOUR_KEYS, HOUR_LABELS, type Employee, type EmployeeYear, type HourKey } from '../types'
import { Card, confirmDelete, DateIn, Field, OptionSelect, orgName, Page, StaffWarnings, Text, Tip, useYear, YearSelect } from '../ui'

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
  const { data, dirty, update, updateNow, submit, discard } = useStore()
  const e = data.employees.find((x) => x.id === id)
  // 開啟時的姓名：提交時若改了名字，同步更新所有紀錄
  const [origName] = useState(() => e?.name ?? '')
  const [busy, setBusy] = useState(false)
  if (!e) return null
  const set = (k: BasicKey, v: string) =>
    update((d) => {
      const x = d.employees.find((y) => y.id === id)
      if (x) (x[k] as string) = v
    })
  const remove = () => updateNow((d) => { d.employees = d.employees.filter((x) => x.id !== id) })

  /** 不提交就關閉：捨棄這次的修改 */
  const cancel = () => {
    const blankNew = e.draft && MODAL_FIELDS.every((f) => !e[f.key])
    if (dirty && !blankNew && !window.confirm('有修改尚未提交，關閉會捨棄這些修改。確定嗎？')) return
    if (dirty) discard()
    onClose()
  }
  const save = async () => {
    const name = e.name.trim()
    if (!name) return window.alert('請填寫姓名')
    update((d) => {
      const x = d.employees.find((y) => y.id === id)
      if (!x) return
      x.name = name
      delete x.draft
      const othersUseOld = d.employees.some((y) => y.id !== id && y.name === origName)
      if (origName && origName !== name && !othersUseOld) renameEverywhere(d, origName, name)
    })
    setBusy(true)
    const ok = await submit()
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <div className="modal-bg" onClick={cancel}>
      <div className="modal staff-modal" onClick={(ev) => ev.stopPropagation()}>
        <h3>
          {e.draft ? '新增員工' : `編輯員工：${origName}`}
          <Tip>居督／照服員依「長照小卡職別」分類。離職請填離職日，不要刪除。改名會同步更新會議、個督等紀錄裡的姓名。</Tip>
        </h3>
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
        <div className="row between">
          {e.draft ? <span /> : (
            <button type="button" className="btn danger ghost" onClick={() => {
              if (!confirmDelete('員工資料', `姓名：${e.name || '（未填姓名）'}`)) return
              void remove().then((ok) => ok && onClose())
            }}>刪除員工</button>
          )}
          <div className="row">
            <button type="button" className="btn ghost" onClick={cancel}>取消</button>
            <button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? '提交中…' : '提交'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StaffPage() {
  const { data, dirty, update, updateNow, submit } = useStore()
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

  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const onImport = async (file?: File) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setImporting(true)
    try {
      const parsed = await parseStaffXlsx(file)
      if (!parsed.rows.length) throw new Error('檔案裡沒有可匯入的員工資料（表頭列下方沒有填姓名的列）。')
      const exist = new Set(emps.map((e) => e.name.trim()))
      const nNew = new Set(parsed.rows.map((r) => r.values.name!).filter((n) => !exist.has(n))).size
      const nUpd = new Set(parsed.rows.map((r) => r.values.name!).filter((n) => exist.has(n))).size
      const ok = window.confirm(
        `讀到 ${parsed.rows.length} 列：新增 ${nNew} 人、更新 ${nUpd} 人。\n年度健檢日期與訓練時數會匯入到 ${yl} 年度。\n\n確定匯入嗎？`,
      )
      if (!ok) return
      update((d) => { applyStaffImport(d, parsed.rows, year) })
      if (!(await submit())) return
      const skipped = parsed.warnings.length
      window.alert(skipped ? `匯入成功（有 ${skipped} 筆資料無法辨識，已略過）` : '匯入成功')
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const add = () => {
    const e = newEmployee()
    update((d) => { d.employees.push(e) })
    setEditing(e.id)
  }

  /** 列表上的刪除：立即存檔，所以頁面上有未提交的修改時先請使用者處理，避免一併送出 */
  const removeEmp = (e: Employee) => {
    if (dirty) return window.alert('這一頁有修改尚未提交，請先按「提交」或捨棄修改，再刪除員工。')
    if (!confirmDelete(`員工資料`, `姓名：${e.name || '（未填姓名）'}\n\n（離職員工建議填寫離職日即可，不需刪除）`)) return
    void updateNow((d) => { d.employees = d.employees.filter((x) => x.id !== e.id) })
  }

  /** 在職員工還沒填的格子以底色提醒 */
  const miss = (e: Employee, v: string) => (!e.leaveDate && !v.trim() ? 'unfilled' : undefined)

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
    <Page title="基本資料建置與連動（員工名冊）" submit actions={<YearSelect />}>
      <StaffWarnings />
      <Card
        title="員工名冊"
        tip={<>點一列可編輯完整資料（體檢、特殊訓練證號等）。基本資料跨年度共用。<br /><span className="legend-unfilled" />底色的格子代表在職員工還沒填。</>}
        actions={<>
        <Tip>
          人數多時可以先「下載匯入範本」，在 Excel 填好後按「匯入 Excel」。以姓名比對，已有的人更新、沒有的人新增；
          範本裡的年度健檢日期與訓練時數會一併匯入到上方選擇的年度（目前 {yl} 年度）。
        </Tip>
        <button type="button" className="btn small ghost" onClick={() => downloadStaffTemplate(`${yl} 年度`)}>下載匯入範本</button>
        <button type="button" className="btn small ghost" disabled={importing} onClick={() => fileRef.current?.click()}>{importing ? '匯入中…' : '匯入 Excel'}</button>
        <button type="button" className="btn small" onClick={add}>＋ 新增員工</button>
        <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => onImport(e.target.files?.[0])} />
        </>}
      >
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
                  <td className={miss(e, e.gender)}>{e.gender}</td>
                  <td className={miss(e, e.title)}>{e.title}</td>
                  <td className={miss(e, e.cardRole)}>{e.cardRole}</td>
                  <td className={miss(e, e.hireDate)}>{fmtDate(e.hireDate, f)}</td>
                  <td>{fmtDate(e.leaveDate, f)}</td>
                  <td className={miss(e, e.cprExpiry)}>{fmtDate(e.cprExpiry, f)}</td>
                  <td><span className="chips">{flags(e).map((x) => <span key={x.text} className={`chip ${x.cls}`}>{x.text}</span>)}</span></td>
                  <td className="ops">
                    <button type="button" className="link">編輯</button>
                    <button type="button" className="link danger" onClick={(ev) => { ev.stopPropagation(); removeEmp(e) }}>刪除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title={`${yl}年度資料：年度健檢與在職訓練時數`}
        tip={<>列出本年度曾在職的員工。訓練時數填全年度各類總時數（小時）。<br /><span className="legend-unfilled" />底色的格子代表還沒填；確定沒有時數請填 0。</>}
      >
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
                  <td className={miss(e, yearlyOf(e).healthCheck)}><input type="date" value={yearlyOf(e).healthCheck} onChange={(ev) => setYearly(e.id, (y) => { y.healthCheck = ev.target.value })} /></td>
                  {HOUR_KEYS.map((k) => (
                    <td key={k} style={{ minWidth: '6em' }} className={miss(e, yearlyOf(e).hours[k])}>
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

      <Card title={`${yl}年度總表匯出（Excel）`} tip="特殊訓練課程總表列出統計日（今年為今天、過去年度為年底）在職的員工；CPR 到期日已過的列為「無」。">
        <div className="row">
          {exports.map((x, i) => (
            <button key={x.label} type="button" className="btn ghost" onClick={() => x.run()}>{i + 1}. {x.label}</button>
          ))}
        </div>
      </Card>

      {editing && <EmployeeModal key={editing} id={editing} onClose={() => setEditing(null)} />}
    </Page>
  )
}
