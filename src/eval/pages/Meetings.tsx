import { byDate, fmtDate, inYear, todayIso, yearLabel } from '../fmt'
import { exportDocx, type DocBlock } from '../exportDocx'
import { exportXlsx } from '../exportXlsx'
import { deletePhoto, getPhotos } from '../photos'
import { uid, usePruneDrafts, useStore } from '../store'
import type { EvalData, Meeting, MeetingKind, Topic } from '../types'
import {
  Area, Card, DateIn, confirmDelete, EditActions, Field, move, NameInput, NamesInput, NotFound, orgName, Page, PhotoField,
  RecordTable, Text, useNames, useStaffNames, useYear, YearSelect,
} from '../ui'

const META: Record<MeetingKind, { no: string; title: string; record: string }> = {
  admin: { no: '2-2', title: '行政會議', record: '行政會議紀錄' },
  group: { no: '2-3', title: '團體督導會議', record: '團體督導會議紀錄' },
}

const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五']
export const cnNo = (i: number) => CN[i] ?? String(i + 1)
const filled = (ts: Topic[]) => ts.filter((t) => t.title.trim() || t.discussion.trim() || t.resolution.trim())
const emptyTopic = (): Topic => ({ id: uid(), title: '', discussion: '', resolution: '' })

function newMeeting(d: EvalData, kind: MeetingKind, year: number): Meeting {
  const date = inYear(todayIso(), year) ? todayIso() : `${year}-01-01`
  // 上一場（可跨年度）：帶入追蹤事項，以及通常不變的地點、主席、紀錄人
  const prev = previousMeeting(d, kind, date, '')
  return {
    id: uid(), kind, date, time: '', place: prev?.place ?? '', chair: prev?.chair ?? '', recorder: prev?.recorder ?? '', attendees: [],
    target: kind === 'group' ? prev?.target || '居服員' : '', prevFollow: prev?.nextFollow ?? '', topics: [emptyTopic()], nextFollow: '', photos: [],
    draft: true,
  }
}

/** 同類會議中，日期在指定日期（含）之前最近的一場，不限年度 */
function previousMeeting(d: EvalData, kind: MeetingKind, date: string, selfId: string) {
  return d.meetings
    .filter((m) => m.kind === kind && m.id !== selfId && !m.draft && m.date && m.date <= date)
    .sort(byDate)
    .at(-1)
}

export function MeetingList({ kind }: { kind: MeetingKind }) {
  const { data, update } = useStore()
  const { year } = useYear()
  const f = data.org.yearFormat
  const yl = yearLabel(year, f)
  const meta = META[kind]
  usePruneDrafts()
  const list = data.meetings.filter((m) => m.kind === kind && inYear(m.date, year)).sort(byDate)
  const base = `#/meetings/${kind}`

  const add = () => {
    const m = newMeeting(data, kind, year)
    update((d) => { d.meetings.push(m) })
    location.hash = `${base}/${m.id}`
  }

  const exportTotal = () => {
    const org = orgName(data)
    if (kind === 'group') {
      return exportXlsx(`${yl}年度團體督導總表`, {
        org, title: `${yl}年度團體督導總表`,
        cols: [{ label: '序', width: 6 }, { label: '會議日期', width: 13 }, { label: '會議時間', width: 10 }, { label: '會議主題', width: 40 }, { label: '對象', width: 12 }],
        rows: list.map((m, i) => [i + 1, fmtDate(m.date, f), m.time, m.topics.map((t) => t.title).filter(Boolean).join('、'), m.target]),
      })
    }
    const numbered = (pick: (t: Topic) => string) => (m: Meeting) => filled(m.topics).map((t, i) => `${i + 1}. ${pick(t)}`).join('\n')
    return exportXlsx(`${yl}年度行政會議總表`, {
      org, title: `${yl}年度行政會議總表`,
      cols: [
        { label: '會議日期', width: 12 }, { label: '會議時間', width: 9 }, { label: '會議地點', width: 12 }, { label: '主席', width: 9 },
        { label: '會議紀錄', width: 9 }, { label: '參與人員', width: 18 }, { label: '上次追蹤事項', width: 26 },
        { label: '議題', width: 22 }, { label: '討論內容', width: 40 }, { label: '決議', width: 32 }, { label: '下次追蹤事項', width: 26 }, { label: '附檔', width: 8 },
      ],
      rows: list.map((m) => [
        fmtDate(m.date, f), m.time, m.place, m.chair, m.recorder, m.attendees.join('、'), m.prevFollow,
        numbered((t) => t.title)(m), numbered((t) => t.discussion)(m), numbered((t) => t.resolution)(m), m.nextFollow,
        m.photos.length ? `照片 ${m.photos.length} 張` : '',
      ]),
    })
  }

  return (
    <Page
      no={meta.no}
      title={meta.title}
      actions={<>
        <YearSelect />
        <button type="button" className="btn ghost" disabled={!list.length} onClick={exportTotal}>匯出年度總表</button>
        <button type="button" className="btn" onClick={add}>＋ 新增會議</button>
      </>}
    >
      <RecordTable
        items={list}
        href={(m) => `${base}/${m.id}`}
        empty={`${yl}年度還沒有${meta.title}紀錄，按「新增會議」開始。`}
        cols={[
          { label: '會議日期', render: (m) => fmtDate(m.date, f), w: '7em' },
          { label: '時間', render: (m) => m.time, w: '4em' },
          { label: '主席', render: (m) => m.chair, w: '6em' },
          { label: '議題', render: (m) => m.topics.map((t) => t.title).filter(Boolean).join('、') },
          { label: '照片', render: (m) => (m.photos.length ? `${m.photos.length} 張` : ''), w: '4em' },
        ]}
      />
    </Page>
  )
}

export async function meetingDoc(d: EvalData, m: Meeting): Promise<DocBlock[]> {
  const f = d.org.yearFormat
  const pairs: [string, string][] = [
    ['會議日期', fmtDate(m.date, f)], ['會議時間', m.time],
    ['會議地點', m.place], ['主席', m.chair],
    ['紀錄', m.recorder], ...(m.kind === 'group' ? [['對象', m.target] as [string, string]] : []),
    ['參與人員', m.attendees.join('、')],
  ]
  const content = filled(m.topics)
    .map((t, i) => `（${cnNo(i)}）${t.title}\n討論：\n${t.discussion}\n決議：\n${t.resolution}`)
    .join('\n\n')
  return [
    { t: 'title', sub: orgName(d), text: META[m.kind].record },
    { t: 'kv', pairs },
    { t: 'box', label: '上次追蹤事項', text: m.prevFollow },
    { t: 'box', label: '會議內容（議題、討論與決議）', text: content },
    { t: 'box', label: '下次追蹤事項', text: m.nextFollow },
    { t: 'photos', photos: await getPhotos(m.photos) },
  ]
}

export function MeetingEdit({ kind, id }: { kind: MeetingKind; id: string }) {
  const { data, update } = useStore()
  const names = useNames()
  const staffNames = useStaffNames()
  const m = data.meetings.find((x) => x.id === id)
  const back = `#/meetings/${kind}`
  if (!m) return <NotFound back={back} />
  const meta = META[kind]
  const set = (fn: (x: Meeting) => void) =>
    update((d) => {
      const x = d.meetings.find((y) => y.id === id)
      if (!x) return
      fn(x)
      delete x.draft
    })
  const prev = previousMeeting(data, kind, m.date, id)
  const pullPrev = () => {
    if (!prev) return
    if (m.prevFollow.trim() && !window.confirm('會以上一場的「下次追蹤事項」取代目前內容，確定嗎？')) return
    set((x) => { x.prevFollow = prev.nextFollow })
  }
  const setTopic = (i: number, k: keyof Omit<Topic, 'id'>, v: string) => set((x) => { x.topics[i][k] = v })

  const onWord = async () => exportDocx(`${meta.record}_${fmtDate(m.date, data.org.yearFormat)}`, await meetingDoc(data, m))
  const onDelete = () => {
    if (!confirmDelete('會議紀錄')) return
    m.photos.forEach((p) => deletePhoto(p))
    update((d) => { d.meetings = d.meetings.filter((x) => x.id !== id) })
    location.hash = back
  }

  return (
    <Page no={meta.no} title={`${meta.title}紀錄`} back={back} actions={<EditActions onWord={onWord} onDelete={onDelete} />}>
      <Card title="基本資料">
        <div className="grid3">
          <Field label="會議日期"><DateIn value={m.date} onChange={(v) => set((x) => { x.date = v })} /></Field>
          <Field label="會議時間"><Text type="time" value={m.time} onChange={(v) => set((x) => { x.time = v })} /></Field>
          <Field label="會議地點"><Text value={m.place} onChange={(v) => set((x) => { x.place = v })} /></Field>
          <Field label="主席"><NameInput names={names} value={m.chair} onChange={(v) => set((x) => { x.chair = v })} /></Field>
          <Field label="紀錄人"><NameInput names={names} value={m.recorder} onChange={(v) => set((x) => { x.recorder = v })} /></Field>
          {kind === 'group' && <Field label="對象"><Text value={m.target} onChange={(v) => set((x) => { x.target = v })} /></Field>}
        </div>
        <Field label="參與人員"><NamesInput names={names} staff={staffNames} value={m.attendees} onChange={(v) => set((x) => { x.attendees = v })} /></Field>
      </Card>

      <Card
        title="上次追蹤事項"
        actions={prev && prev.nextFollow !== m.prevFollow && (
          <button type="button" className="btn small ghost" onClick={pullPrev}>
            重新帶入上一場（{fmtDate(prev.date, data.org.yearFormat)}）的追蹤事項
          </button>
        )}
      >
        <Area value={m.prevFollow} onChange={(v) => set((x) => { x.prevFollow = v })} placeholder={prev ? '上一場沒有填「下次追蹤事項」' : '沒有更早的會議可以帶入'} />
      </Card>

      <Card title="議題、討論與決議" actions={<button type="button" className="btn small" onClick={() => set((x) => { x.topics.push(emptyTopic()) })}>＋ 新增議題</button>}>
        {m.topics.map((t, i) => (
          <div key={t.id} className="topic">
            <div className="row between">
              <b className="topic-no">（{cnNo(i)}）</b>
              <div className="row">
                <button type="button" className="icon" disabled={i === 0} title="上移" onClick={() => set((x) => { x.topics = move(x.topics, i, -1) })}>↑</button>
                <button type="button" className="icon" disabled={i === m.topics.length - 1} title="下移" onClick={() => set((x) => { x.topics = move(x.topics, i, 1) })}>↓</button>
                <button type="button" className="icon" title="刪除議題" onClick={() => {
                  if (window.confirm('刪除這個議題？')) set((x) => { x.topics.splice(i, 1) })
                }}>✕</button>
              </div>
            </div>
            <Field label="議題標題"><Text value={t.title} onChange={(v) => setTopic(i, 'title', v)} /></Field>
            <Field label="討論內容"><Area value={t.discussion} onChange={(v) => setTopic(i, 'discussion', v)} /></Field>
            <Field label="決議"><Area value={t.resolution} onChange={(v) => setTopic(i, 'resolution', v)} rows={2} /></Field>
          </div>
        ))}
        {!m.topics.length && <div className="empty">尚無議題。</div>}
      </Card>

      <Card title="下次追蹤事項">
        <Area value={m.nextFollow} onChange={(v) => set((x) => { x.nextFollow = v })} />
      </Card>

      <Card title="會議照片">
        <PhotoField ids={m.photos} onChange={(ids) => set((x) => { x.photos = ids })} />
      </Card>
    </Page>
  )
}
