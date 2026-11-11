import { byDate, fmtDate, inYear, todayIso, yearLabel } from '../fmt'
import { exportDocx } from '../exportDocx'
import { exportXlsx } from '../exportXlsx'
import { deletePhoto, getPhotos } from '../photos'
import { uid, usePruneDrafts, useStore } from '../store'
import type { CaseMeeting, Professional } from '../types'
import {
  Area, Card, DateIn, confirmDelete, EditActions, Field, NameInput, NotFound, OptionSelect, orgName, Page, PhotoField,
  RecordTable, Text, useNames, useYear, YearSelect,
} from '../ui'

const BACK = '#/casemeet'
const categories = (m: CaseMeeting) => [...new Set(m.professionals.map((p) => p.category).filter(Boolean))].join('、')
const emptyProf = (): Professional => ({ id: uid(), name: '', category: '' })

const TEXT_FIELDS: [keyof Pick<CaseMeeting, 'summary' | 'issues' | 'suggestions' | 'followup'>, string][] = [
  ['summary', '個案現況摘要（含已提供服務及因應措施）'],
  ['issues', '跨專業討論的問題'],
  ['suggestions', '與會專業人員建議之要點'],
  ['followup', '跨專業討論的問題後續追蹤及結案說明'],
]

export function CaseMeetingList() {
  const { data, update } = useStore()
  const { year } = useYear()
  const f = data.org.yearFormat
  const yl = yearLabel(year, f)
  usePruneDrafts()
  const list = data.caseMeetings.filter((m) => inYear(m.date, year)).sort(byDate)

  const add = () => {
    // 地點、紀錄人通常不變，帶入最近一場的值
    const prev = data.caseMeetings.filter((m) => !m.draft).sort(byDate).at(-1)
    const m: CaseMeeting = {
      id: uid(), date: inYear(todayIso(), year) ? todayIso() : `${year}-01-01`, time: '', place: prev?.place ?? '', recorder: prev?.recorder ?? '',
      professionals: [emptyProf()], summary: '', issues: '', suggestions: '', followup: '', photos: [], draft: true,
    }
    update((d) => { d.caseMeetings.push(m) })
    location.hash = `${BACK}/${m.id}`
  }

  const exportTotal = () =>
    exportXlsx(`${yl}年度個案討論會總表`, {
      org: orgName(data),
      title: `${yl}年度個案討論會總表`,
      cols: [{ label: '序', width: 6 }, { label: '會議日期', width: 13 }, { label: '會議時間', width: 10 }, { label: '與會專業類別', width: 36 }],
      rows: list.map((m, i) => [i + 1, fmtDate(m.date, f), m.time, categories(m)]),
    })

  return (
    <Page
      title="個案討論會"
      actions={<>
        <YearSelect />
        <button type="button" className="btn ghost" disabled={!list.length} onClick={exportTotal}>匯出年度總表</button>
        <button type="button" className="btn" onClick={add}>＋ 新增會議</button>
      </>}
    >
      <RecordTable
        items={list}
        href={(m) => `${BACK}/${m.id}`}
        empty={`${yl}年度還沒有個案討論會，按「新增會議」開始。`}
        cols={[
          { label: '會議日期', render: (m) => fmtDate(m.date, f), w: '7em' },
          { label: '時間', render: (m) => m.time, w: '4em' },
          { label: '與會專業類別', render: categories },
          { label: '跨專業討論的問題', render: (m) => <span className="clip">{m.issues}</span> },
        ]}
      />
    </Page>
  )
}

export function CaseMeetingEdit({ id }: { id: string }) {
  const { data, update } = useStore()
  const names = useNames()
  const m = data.caseMeetings.find((x) => x.id === id)
  if (!m) return <NotFound back={BACK} />
  const f = data.org.yearFormat
  const set = (fn: (x: CaseMeeting) => void) =>
    update((d) => {
      const x = d.caseMeetings.find((y) => y.id === id)
      if (!x) return
      fn(x)
      delete x.draft
    })
  const setProf = (i: number, k: 'name' | 'category', v: string) => set((x) => { x.professionals[i][k] = v })

  const onWord = async () =>
    exportDocx(`個案討論會紀錄_${fmtDate(m.date, f)}`, [
      { t: 'title', sub: orgName(data), text: '個案討論會紀錄' },
      { t: 'kv', pairs: [['會議日期', fmtDate(m.date, f)], ['會議時間', m.time], ['會議地點', m.place], ['紀錄', m.recorder]] },
      { t: 'h', text: '參與專業人員' },
      { t: 'table', headers: ['姓名', '專業類別'], rows: m.professionals.filter((p) => p.name || p.category).map((p) => [p.name, p.category]) },
      ...TEXT_FIELDS.map(([k, label]) => ({ t: 'box' as const, label, text: m[k] })),
      { t: 'photos', photos: await getPhotos(m.photos) },
    ])
  const onDelete = () => {
    if (!confirmDelete('個案討論會紀錄')) return
    m.photos.forEach((p) => deletePhoto(p))
    update((d) => { d.caseMeetings = d.caseMeetings.filter((x) => x.id !== id) })
    location.hash = BACK
  }

  return (
    <Page title="個案討論會紀錄" back={BACK} actions={<EditActions onWord={onWord} onDelete={onDelete} />}>
      <Card title="基本資料">
        <div className="grid2">
          <Field label="會議日期"><DateIn value={m.date} onChange={(v) => set((x) => { x.date = v })} /></Field>
          <Field label="會議時間"><Text type="time" value={m.time} onChange={(v) => set((x) => { x.time = v })} /></Field>
          <Field label="會議地點"><Text value={m.place} onChange={(v) => set((x) => { x.place = v })} /></Field>
          <Field label="紀錄人"><NameInput names={names} value={m.recorder} onChange={(v) => set((x) => { x.recorder = v })} /></Field>
        </div>
      </Card>

      <Card title="參與專業人員" actions={<button type="button" className="btn small" onClick={() => set((x) => { x.professionals.push(emptyProf()) })}>＋ 新增人員</button>}>
        <table className="grid">
          <thead><tr><th className="no">#</th><th>姓名</th><th>專業類別</th><th /></tr></thead>
          <tbody>
            {m.professionals.map((p, i) => (
              <tr key={p.id}>
                <td className="no">{i + 1}</td>
                <td><NameInput names={names} value={p.name} onChange={(v) => setProf(i, 'name', v)} /></td>
                <td><OptionSelect optKey="profCategory" value={p.category} onChange={(v) => setProf(i, 'category', v)} /></td>
                <td className="ops"><button type="button" className="icon" title="刪除" onClick={() => set((x) => { x.professionals.splice(i, 1) })}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="討論內容">
        {TEXT_FIELDS.map(([k, label]) => (
          <Field key={k} label={label}><Area value={m[k]} onChange={(v) => set((x) => { x[k] = v })} /></Field>
        ))}
      </Card>

      <Card title="附檔（會議照片）">
        <PhotoField ids={m.photos} onChange={(ids) => set((x) => { x.photos = ids })} />
      </Card>
    </Page>
  )
}
