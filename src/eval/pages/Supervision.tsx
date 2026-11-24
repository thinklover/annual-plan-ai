import { activeInYear, byDate, fmtDate, fmtMD, inYear, isCaregiver, isSupervisor, todayIso, yearLabel } from '../fmt'
import { exportDocx } from '../exportDocx'
import { exportXlsx } from '../exportXlsx'
import { getPhotos } from '../photos'
import { uid, usePruneDrafts, useStore } from '../store'
import type { Supervision } from '../types'
import {
  AiImport, Area, Card, DateIn, confirmDelete, EditActions, Field, NameInput, NotFound, orgName, Page, PhotoField, RecordTable, useYear, YearSelect,
} from '../ui'

const BACK = '#/supervision'

export function SupervisionList() {
  const { data, update, go } = useStore()
  const { year } = useYear()
  const f = data.org.yearFormat
  const yl = yearLabel(year, f)
  usePruneDrafts()
  const list = data.supervisions.filter((s) => inYear(s.date, year)).sort(byDate)

  // 尚未個督：目前在職、今年還沒有個督紀錄的照服員
  const done = new Set(list.map((s) => s.staff))
  const pending = data.employees.filter(
    (e) => e.name && isCaregiver(e) && activeInYear(e, year) && !(e.leaveDate && e.leaveDate <= todayIso()) && !done.has(e.name),
  )

  const add = (staff = '') => {
    // 主責居督：優先帶職稱是「督導員」的人，其次才是小卡職別為居督的人（例如業務負責人）
    const sups = data.employees.filter((e) => e.name && isSupervisor(e) && activeInYear(e, year) && !e.leaveDate)
    const sup = sups.find((e) => /督導/.test(e.title)) ?? sups[0]
    const s: Supervision = {
      id: uid(), date: inYear(todayIso(), year) ? todayIso() : `${year}-01-01`, staff, problem: '', feedback: '', plan: '',
      supervisor: sup?.name ?? '', photos: [], draft: true,
    }
    update((d) => { d.supervisions.push(s) })
    go(`${BACK}/${s.id}`)
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
      title="個別督導紀錄"
      actions={<>
        <YearSelect />
        <button type="button" className="btn ghost" onClick={exportTotal}>匯出年度總表</button>
        <button type="button" className="btn" onClick={() => add()}>＋ 新增個督紀錄</button>
      </>}
    >
      {pending.length > 0 && (
        <section className="block">
          <div className="pending">
            <b>{yl}年度尚未個督（{pending.length} 人）：</b>
            {pending.map((e) => <button type="button" key={e.id} title="點一下新增這位的個督紀錄" onClick={() => add(e.name)}>{e.name}</button>)}
          </div>
        </section>
      )}
      <RecordTable
        items={list}
        href={(s) => `${BACK}/${s.id}`}
        empty={`${yl}年度還沒有個督紀錄，按「新增個督紀錄」開始。`}
        what="個督紀錄"
        label={(s) => `個督日期：${fmtDate(s.date, f)}${s.staff ? `　人員：${s.staff}` : ''}`}
        remove={(d, s) => { d.supervisions = d.supervisions.filter((x) => x.id !== s.id) }}
        cols={[
          { label: '個督日期', render: (s) => fmtDate(s.date, f), w: '7em' },
          { label: '人員姓名', render: (s) => s.staff, w: '7em' },
          { label: '問題', render: (s) => <span className="clip">{s.problem}</span> },
          { label: '主責居督', render: (s) => s.supervisor, w: '6em' },
          { label: '簽名文件', render: (s) => (s.photos.length ? `${s.photos.length} 張` : ''), w: '5em' },
        ]}
      />
    </Page>
  )
}

export function SupervisionEdit({ id }: { id: string }) {
  const { data, update, updateNow, go } = useStore()
  const { year } = useYear()
  const s = data.supervisions.find((x) => x.id === id)
  if (!s) return <NotFound back={BACK} />
  const f = data.org.yearFormat
  const y = Number(s.date.slice(0, 4)) || year
  const set = (fn: (x: Supervision) => void) =>
    update((d) => {
      const x = d.supervisions.find((z) => z.id === id)
      if (!x) return
      fn(x)
      delete x.draft
    })

  // 今年還沒做過個督的人排前面
  const done = new Set(data.supervisions.filter((x) => inYear(x.date, y) && x.id !== id).map((x) => x.staff))
  const staff = data.employees.filter((e) => e.name && activeInYear(e, y) && !isSupervisor(e))
  const staffNames = [...staff.filter((e) => !done.has(e.name)), ...staff.filter((e) => done.has(e.name))].map((e) => e.name)
  const supNames = data.employees.filter((e) => e.name && isSupervisor(e) && activeInYear(e, y)).map((e) => e.name)
  const hire = data.employees.find((e) => e.name === s.staff)?.hireDate ?? ''

  const importPrompt = `這是居家服務督導員與照顧服務員「個別督導」的錄音或書面紀錄表。請整理成個別督導紀錄：
- problem：督導中討論的問題（服務上遇到的狀況、需要改進的地方）。
- feedback：人員（照顧服務員）的回饋與想法。
- plan：改善方案及期限（誰、做什麼、何時完成）。
輸出格式：{"problem": "…", "feedback": "…", "plan": "…"}`
  const filled = !!(s.problem.trim() || s.feedback.trim() || s.plan.trim())
  const onImport = (out: { problem?: string; feedback?: string; plan?: string }) => {
    const next = { problem: String(out.problem ?? '').trim(), feedback: String(out.feedback ?? '').trim(), plan: String(out.plan ?? '').trim() }
    if (!next.problem && !next.feedback && !next.plan) return false
    if (filled && !window.confirm('AI 整理的內容會覆蓋目前的問題、人員回饋、改善方案及期限，確定嗎？')) return true
    // AI 沒整理出來的欄位保留原內容
    set((x) => {
      if (next.problem) x.problem = next.problem
      if (next.feedback) x.feedback = next.feedback
      if (next.plan) x.plan = next.plan
    })
    return true
  }

  const onWord = async () =>
    exportDocx(`個別督導紀錄_${s.staff}_${fmtDate(s.date, f)}`, [
      { t: 'title', sub: orgName(data), text: '個別督導紀錄' },
      { t: 'kv', pairs: [['個督日期', fmtDate(s.date, f)], ['主責居督', s.supervisor], ['人員姓名', s.staff], ['到職日', fmtDate(hire, f)]] },
      { t: 'box', label: '問題', text: s.problem },
      { t: 'box', label: '人員回饋', text: s.feedback },
      { t: 'box', label: '改善方案及期限', text: s.plan },
      { t: 'photos', label: '簽名文件', photos: await getPhotos(s.photos) },
    ])
  const onDelete = () => {
    if (!confirmDelete('個督紀錄')) return
    void updateNow((d) => { d.supervisions = d.supervisions.filter((x) => x.id !== id) }).then((ok) => ok && go(BACK))
  }

  return (
    <Page title="個別督導紀錄" back={BACK} actions={<EditActions onWord={onWord} onDelete={onDelete} />}>
      <Card title="基本資料">
        <div className="grid3">
          <Field label="個督日期"><DateIn value={s.date} onChange={(v) => set((x) => { x.date = v })} /></Field>
          <Field
            label="人員姓名"
            help="清單中今年還沒做過個督的人排在前面。"
            note={s.staff && done.has(s.staff) ? `${s.staff} 今年已做過個督，這筆會再加一個日期。` : undefined}
          >
            <NameInput names={staffNames} value={s.staff} onChange={(v) => set((x) => { x.staff = v })} />
          </Field>
          <Field label="主責居督" note={supNames.length ? undefined : '員工名冊中沒有居督（長照小卡職別含「督」）。'}>
            <NameInput names={supNames} value={s.supervisor} onChange={(v) => set((x) => { x.supervisor = v })} />
          </Field>
        </div>
      </Card>

      <AiImport prompt={importPrompt} onResult={onImport} fields={['問題', '人員回饋', '改善方案及期限']} replace filled={filled} />

      <Card title="個督內容">
        <Field label="問題"><Area value={s.problem} onChange={(v) => set((x) => { x.problem = v })} /></Field>
        <Field label="人員回饋"><Area value={s.feedback} onChange={(v) => set((x) => { x.feedback = v })} /></Field>
        <Field label="改善方案及期限"><Area value={s.plan} onChange={(v) => set((x) => { x.plan = v })} /></Field>
      </Card>
      <Card title="簽名文件存檔" tip="雙方簽名的個別督導紀錄表，請拍照或掃描成圖檔上傳存檔；匯出 Word 時會附在最後。">
        <PhotoField alt="簽名文件" ids={s.photos} onChange={(ids) => set((x) => { x.photos = ids })} />
      </Card>
    </Page>
  )
}
