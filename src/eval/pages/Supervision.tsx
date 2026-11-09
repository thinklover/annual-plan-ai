import { activeInYear, byDate, fmtDate, fmtMD, inYear, isCaregiver, isSupervisor, todayIso, yearLabel } from '../fmt'
import { exportDocx } from '../exportDocx'
import { exportXlsx } from '../exportXlsx'
import { uid, useStore } from '../store'
import type { Supervision } from '../types'
import {
  Area, Card, DateIn, confirmDelete, EditActions, Field, NameInput, NotFound, orgName, Page, RecordTable, useYear, YearSelect,
} from '../ui'

const BACK = '#/supervision'

export function SupervisionList() {
  const { data, update } = useStore()
  const { year } = useYear()
  const f = data.org.yearFormat
  const yl = yearLabel(year, f)
  const list = data.supervisions.filter((s) => inYear(s.date, year)).sort(byDate)

  const add = () => {
    const sup = data.employees.find((e) => isSupervisor(e) && activeInYear(e, year))
    const s: Supervision = {
      id: uid(), date: inYear(todayIso(), year) ? todayIso() : `${year}-01-01`, staff: '', problem: '', feedback: '', plan: '',
      supervisor: sup?.name ?? '',
    }
    update((d) => { d.supervisions.push(s) })
    location.hash = `${BACK}/${s.id}`
  }

  const exportTotal = () => {
    const caregivers = data.employees.filter((e) => isCaregiver(e) && activeInYear(e, year))
    const names = new Set(caregivers.map((e) => e.name))
    // 被督導但不在照服員名單內的人也列出
    const extra = [...new Set(list.map((s) => s.staff).filter((n) => n && !names.has(n)))]
    const rows = [
      ...caregivers.sort((a, b) => a.hireDate.localeCompare(b.hireDate)).map((e) => ({ name: e.name, hire: e.hireDate })),
      ...extra.map((n) => ({ name: n, hire: data.employees.find((e) => e.name === n)?.hireDate ?? '' })),
    ]
    return exportXlsx(`${yl}年個別督導總表`, {
      org: orgName(data),
      title: `${yl}年個別督導總表`,
      cols: [{ label: '序', width: 6 }, { label: '姓名', width: 12 }, { label: '到職日', width: 13 }, { label: '個督日期', width: 30 }],
      rows: rows.map((r, i) => [
        i + 1, r.name, fmtDate(r.hire, f),
        list.filter((s) => s.staff === r.name).map((s) => fmtMD(s.date)).join('、'),
      ]),
    })
  }

  return (
    <Page
      no="2-4"
      title="個別督導紀錄"
      actions={<>
        <YearSelect />
        <button type="button" className="btn ghost" onClick={exportTotal}>匯出年度總表</button>
        <button type="button" className="btn" onClick={add}>＋ 新增個督紀錄</button>
      </>}
    >
      <RecordTable
        items={list}
        href={(s) => `${BACK}/${s.id}`}
        empty={`${yl}年度還沒有個督紀錄，按「新增個督紀錄」開始。`}
        cols={[
          { label: '個督日期', render: (s) => fmtDate(s.date, f), w: '7em' },
          { label: '人員姓名', render: (s) => s.staff, w: '7em' },
          { label: '問題', render: (s) => <span className="clip">{s.problem}</span> },
          { label: '主責居督', render: (s) => s.supervisor, w: '6em' },
        ]}
      />
    </Page>
  )
}

export function SupervisionEdit({ id }: { id: string }) {
  const { data, update } = useStore()
  const { year } = useYear()
  const s = data.supervisions.find((x) => x.id === id)
  if (!s) return <NotFound back={BACK} />
  const f = data.org.yearFormat
  const y = Number(s.date.slice(0, 4)) || year
  const set = (fn: (x: Supervision) => void) =>
    update((d) => {
      const x = d.supervisions.find((z) => z.id === id)
      if (x) fn(x)
    })

  // 今年還沒做過個督的人排前面
  const done = new Set(data.supervisions.filter((x) => inYear(x.date, y) && x.id !== id).map((x) => x.staff))
  const staff = data.employees.filter((e) => e.name && activeInYear(e, y) && !isSupervisor(e))
  const staffNames = [...staff.filter((e) => !done.has(e.name)), ...staff.filter((e) => done.has(e.name))].map((e) => e.name)
  const supNames = data.employees.filter((e) => e.name && isSupervisor(e) && activeInYear(e, y)).map((e) => e.name)
  const hire = data.employees.find((e) => e.name === s.staff)?.hireDate ?? ''

  const onWord = () =>
    exportDocx(`個別督導紀錄_${s.staff}_${fmtDate(s.date, f)}`, [
      { t: 'title', sub: orgName(data), text: '個別督導紀錄' },
      { t: 'kv', pairs: [['個督日期', fmtDate(s.date, f)], ['主責居督', s.supervisor], ['人員姓名', s.staff], ['到職日', fmtDate(hire, f)]] },
      { t: 'box', label: '問題', text: s.problem },
      { t: 'box', label: '人員回饋', text: s.feedback },
      { t: 'box', label: '改善方案及期限', text: s.plan },
    ])
  const onDelete = () => {
    if (!confirmDelete('個督紀錄')) return
    update((d) => { d.supervisions = d.supervisions.filter((x) => x.id !== id) })
    location.hash = BACK
  }

  return (
    <Page no="2-4" title="個別督導紀錄" back={BACK} actions={<EditActions onWord={onWord} onDelete={onDelete} />}>
      <Card title="基本資料">
        <div className="grid3">
          <Field label="個督日期"><DateIn value={s.date} onChange={(v) => set((x) => { x.date = v })} /></Field>
          <Field
            label="人員姓名"
            help={s.staff && done.has(s.staff) ? `${s.staff} 今年已做過個督，這筆會再加一個日期。` : '清單中今年還沒做過個督的人排在前面。'}
          >
            <NameInput names={staffNames} value={s.staff} onChange={(v) => set((x) => { x.staff = v })} />
          </Field>
          <Field label="主責居督" help={supNames.length ? undefined : '員工名冊中沒有居督（長照小卡職別含「督」）。'}>
            <NameInput names={supNames} value={s.supervisor} onChange={(v) => set((x) => { x.supervisor = v })} />
          </Field>
        </div>
      </Card>
      <Card title="個督內容">
        <Field label="問題"><Area value={s.problem} onChange={(v) => set((x) => { x.problem = v })} /></Field>
        <Field label="人員回饋"><Area value={s.feedback} onChange={(v) => set((x) => { x.feedback = v })} /></Field>
        <Field label="改善方案及期限"><Area value={s.plan} onChange={(v) => set((x) => { x.plan = v })} /></Field>
      </Card>
    </Page>
  )
}
