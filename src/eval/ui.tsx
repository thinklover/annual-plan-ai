import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { activeInYear, fmtDate, staffIssues, thisYear, todayIso, yearLabel } from './fmt'
import { addPhoto, deletePhoto, getPhotos, MAX_PHOTOS, type Photo } from './photos'
import { optionsOf, useStore } from './store'
import type { EvalData } from './types'

// ---------- 年度 ----------
const YearCtx = createContext<{ year: number; setYear: (y: number) => void }>({ year: thisYear(), setYear: () => {} })
export function YearProvider({ children }: { children: ReactNode }) {
  const [year, setYear] = useState(() => {
    try {
      return Number(sessionStorage.getItem('home-eval:year')) || thisYear()
    } catch {
      return thisYear()
    }
  })
  const set = (y: number) => {
    setYear(y)
    try {
      sessionStorage.setItem('home-eval:year', String(y))
    } catch { /* 無痕模式等情況忽略 */ }
  }
  return <YearCtx.Provider value={{ year, setYear: set }}>{children}</YearCtx.Provider>
}
export const useYear = () => useContext(YearCtx)

export function YearSelect() {
  const { year, setYear } = useYear()
  const { data } = useStore()
  const f = data.org.yearFormat
  const years = Array.from({ length: 8 }, (_, i) => thisYear() + 1 - i)
  if (!years.includes(year)) years.push(year)
  return (
    <label className="year-select">
      <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
        {years.sort((a, b) => b - a).map((y) => (
          <option key={y} value={y}>{yearLabel(y, f)} 年度</option>
        ))}
      </select>
    </label>
  )
}

/** 例如「114年度」 */
export function useYearText() {
  const { year } = useYear()
  const { data } = useStore()
  return `${yearLabel(year, data.org.yearFormat)}年度`
}

// ---------- 版面 ----------
export function Page({ title, no, actions, children, back = '#/' }: { title: string; no?: string; actions?: ReactNode; children: ReactNode; back?: string }) {
  return (
    <>
      <header className="topbar">
        <a className="btn ghost small" href={back}>← 返回</a>
        <div className="topbar-title">
          {no && <span className="block-no">{no}</span>}
          <h1>{title}</h1>
        </div>
        <div className="topbar-actions">{actions}</div>
      </header>
      <main className="eval-main">{children}</main>
    </>
  )
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="block">
      {(title || actions) && (
        <div className="block-head">
          {title && <h2 className="block-title">{title}</h2>}
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className="block-body">{children}</div>
    </section>
  )
}

export function Field({ label, children, help, wide }: { label: string; children: ReactNode; help?: string; wide?: boolean }) {
  return (
    <div className={wide ? 'field wide' : 'field'}>
      <div className="field-head"><label>{label}</label></div>
      {children}
      {help && <div className="help">{help}</div>}
    </div>
  )
}

export function Text({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

/** 日期選擇器；瀏覽器只能顯示西元，下方另外顯示機構設定的格式（例如 114.07.30） */
export function DateIn({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useStore()
  return (
    <div className="date-in">
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
      {value && <span className="help">{fmtDate(value, data.org.yearFormat)}</span>}
    </div>
  )
}

export function Area({ value, onChange, rows = 3, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return <textarea ref={ref} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

// ---------- 姓名 ----------
/** 員工名冊（該年度在職者優先）＋歷史上用過的姓名 */
export function useNames(extra: string[] = []) {
  const { data } = useStore()
  const { year } = useYear()
  const staff = data.employees.filter((e) => e.name && activeInYear(e, year)).map((e) => e.name)
  const used = [
    ...data.meetings.flatMap((m) => [m.chair, m.recorder, ...m.attendees]),
    ...data.caseMeetings.flatMap((m) => [m.recorder, ...m.professionals.map((p) => p.name)]),
    ...data.supervisions.flatMap((s) => [s.staff, s.supervisor]),
  ]
  return [...new Set([...staff, ...extra, ...used].filter(Boolean))]
}

/** 目前在職的員工姓名（「全選名冊」用，不含外部人員） */
export function useStaffNames() {
  const { data } = useStore()
  const { year } = useYear()
  const ref = year === thisYear() ? todayIso() : `${year}-12-31`
  return data.employees
    .filter((e) => e.name && e.hireDate && e.hireDate <= ref && (!e.leaveDate || e.leaveDate > ref))
    .map((e) => e.name)
}

/** 名冊資料不完整會讓人數算錯，在相關頁面提醒 */
export function StaffWarnings({ link }: { link?: boolean }) {
  const { data } = useStore()
  const { year } = useYear()
  const { noGender, unclassified, noHire } = staffIssues(data.employees, year)
  if (!noGender.length && !unclassified.length && !noHire.length) return null
  return (
    <div className="notice">
      <b>員工名冊有資料會影響人數統計：</b>
      {noGender.length > 0 && <div>未填性別（不會算進男／女人數）：{noGender.join('、')}</div>}
      {unclassified.length > 0 && <div>無法判斷是居督或照服員（不會算進人數，請填「長照小卡職別」）：{unclassified.join('、')}</div>}
      {noHire.length > 0 && <div>未填到職日（不會出現在任何年度）：{noHire.join('、')}</div>}
      {link && <a className="link" href="#/staff">前往員工名冊</a>}
    </div>
  )
}

export function NameInput({ value, onChange, names, placeholder }: { value: string; onChange: (v: string) => void; names: string[]; placeholder?: string }) {
  const id = useId()
  return (
    <>
      <input list={id} value={value} placeholder={placeholder ?? '輸入或選擇姓名'} onChange={(e) => onChange(e.target.value)} />
      <datalist id={id}>{names.map((n) => <option key={n} value={n} />)}</datalist>
    </>
  )
}

export function NamesInput({ value, onChange, names, staff }: { value: string[]; onChange: (v: string[]) => void; names: string[]; staff: string[] }) {
  const [draft, setDraft] = useState('')
  const id = useId()
  const add = (raw: string) => {
    const parts = raw.split(/[、,，\s]+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length) onChange([...new Set([...value, ...parts])])
    setDraft('')
  }
  const rest = names.filter((n) => !value.includes(n))
  return (
    <div className="names">
      <div className="chips">
        {value.map((n) => (
          <span key={n} className="chip info">
            {n}
            <button type="button" className="chip-x" aria-label={`移除 ${n}`} onClick={() => onChange(value.filter((x) => x !== n))}>×</button>
          </span>
        ))}
      </div>
      <div className="row">
        <input
          list={id}
          value={draft}
          placeholder="輸入姓名後按 Enter，或從清單選擇"
          onChange={(e) => {
            const v = e.target.value
            if (rest.includes(v)) add(v)
            else setDraft(v)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(draft)
            }
          }}
          onBlur={() => draft && add(draft)}
        />
        <datalist id={id}>{rest.map((n) => <option key={n} value={n} />)}</datalist>
        {staff.some((n) => !value.includes(n)) && (
          <button type="button" className="btn tiny ghost" title="加入目前在職的全部員工" onClick={() => onChange([...new Set([...value, ...staff])])}>全選在職員工</button>
        )}
      </div>
    </div>
  )
}

// ---------- 可自行增加的下拉選單 ----------
export function OptionSelect({ optKey, value, onChange, placeholder = '請選擇' }: { optKey: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { data, update } = useStore()
  const opts = optionsOf(data, optKey)
  const list = value && !opts.includes(value) ? [...opts, value] : opts
  return (
    <select
      value={value}
      onChange={(e) => {
        const v = e.target.value
        if (v !== '__add') return onChange(v)
        const name = window.prompt('新增選項名稱')?.trim()
        if (!name) return
        update((d) => {
          d.options[optKey] = [...new Set([...(d.options[optKey] ?? []), name])]
        })
        onChange(name)
      }}
    >
      <option value="">{placeholder}</option>
      {list.map((o) => <option key={o} value={o}>{o}</option>)}
      <option value="__add">＋ 新增選項…</option>
    </select>
  )
}

// ---------- 照片 ----------
export function usePhotos(ids: string[]) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const key = ids.join(',')
  useEffect(() => {
    let alive = true
    getPhotos(key ? key.split(',') : []).then((p) => alive && setPhotos(p))
    return () => {
      alive = false
    }
  }, [key])
  return photos
}

export function PhotoField({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const photos = usePhotos(ids)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const add = async (files: FileList | null) => {
    if (!files?.length) return
    const room = MAX_PHOTOS - ids.length
    const list = [...files].slice(0, room)
    if (files.length > room) window.alert(`每筆最多 ${MAX_PHOTOS} 張，只加入前 ${room} 張。`)
    setBusy(true)
    try {
      const added: string[] = []
      for (const f of list) added.push((await addPhoto(f)).id)
      onChange([...ids, ...added])
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  return (
    <div>
      <div className="photos">
        {photos.map((p) => (
          <figure key={p.id}>
            <img src={p.dataUrl} alt="會議照片" />
            <button type="button" className="btn tiny danger ghost" onClick={() => {
              if (!window.confirm('刪除這張照片？')) return
              deletePhoto(p.id)
              onChange(ids.filter((x) => x !== p.id))
            }}>刪除</button>
          </figure>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn small ghost" disabled={busy || ids.length >= MAX_PHOTOS} onClick={() => fileRef.current?.click()}>
          {busy ? '處理中…' : '＋ 上傳照片'}
        </button>
        <span className="help">{ids.length}/{MAX_PHOTOS} 張，上傳時自動縮小。</span>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
      </div>
    </div>
  )
}

// ---------- 紀錄列表 ----------
export function RecordTable<T extends { id: string }>({ items, cols, href, empty }: {
  items: T[]
  cols: { label: string; render: (x: T) => ReactNode; w?: string }[]
  href: (x: T) => string
  empty: string
}) {
  if (!items.length) return <div className="empty big">{empty}</div>
  return (
    <div className="table-wrap">
      <table className="grid records">
        <thead>
          <tr><th className="no">序</th>{cols.map((c) => <th key={c.label} style={{ width: c.w }}>{c.label}</th>)}<th /></tr>
        </thead>
        <tbody>
          {items.map((x, i) => (
            <tr key={x.id} onClick={() => (location.hash = href(x))}>
              <td className="no">{i + 1}</td>
              {cols.map((c) => <td key={c.label}>{c.render(x)}</td>)}
              <td className="ops"><a className="link" href={href(x)}>編輯</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 編輯頁上方的按鈕：匯出 Word、刪除 */
export function EditActions({ onWord, onDelete }: { onWord: () => void; onDelete: () => void }) {
  return (
    <>
      <span className="help saved">已自動儲存</span>
      <button type="button" className="btn" onClick={onWord}>匯出 Word</button>
      <button type="button" className="btn danger ghost" onClick={onDelete}>刪除</button>
    </>
  )
}

export function NotFound({ back }: { back: string }) {
  return (
    <Page title="找不到資料" back={back}>
      <div className="empty big">這筆資料不存在或已刪除。<a className="link" href={back}>回列表</a></div>
    </Page>
  )
}

// ---------- 其他 ----------
export function Building({ title }: { title: string }) {
  return (
    <Page title={title}>
      <div className="empty big">此項目建置中。</div>
    </Page>
  )
}

export function confirmDelete(what: string) {
  return window.confirm(`確定刪除這筆${what}？刪除後無法復原。`)
}

export const orgName = (d: EvalData) => d.org.name.trim() || '（請先到首頁「機構設定」填寫機構全銜）'

/** 上下移動陣列元素 */
export function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const next = [...arr]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}
