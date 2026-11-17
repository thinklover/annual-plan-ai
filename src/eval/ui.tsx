import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { generateFromFile, parseJson } from '../gemini'
import { getSettings } from '../storage'
import { activeInYear, fmtDate, staffIssues, thisYear, todayIso, yearLabel } from './fmt'
import { addPhoto, getPhotos, MAX_PHOTOS, type Photo } from './photos'
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
      <span>年度</span>
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
/** 「提交」按鈕：修改不會自動儲存，按了才寫入 */
export function SubmitButton() {
  const { dirty, justSaved, saving, submit } = useStore()
  return (
    <>
      <span className={dirty ? 'help saved unsaved' : 'help saved'} role="status">{dirty ? '有修改尚未提交' : justSaved ? '已提交' : ''}</span>
      <button type="button" className="btn primary submit" disabled={!dirty || saving} onClick={() => void submit()}>{saving ? '提交中…' : '提交'}</button>
    </>
  )
}

/** submit＝這一頁可以填寫，頁首放「提交」按鈕 */
export function Page({ title, actions, children, back = '#/', submit }: { title: string; actions?: ReactNode; children: ReactNode; back?: string; submit?: boolean }) {
  const { data } = useStore()
  return (
    <>
      <header className="page-head">
        <div className="page-head-inner">
          <a className="page-back" href={back} title="返回" aria-label="返回">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </a>
          <div className="page-title">
            <span className="page-kicker">{data.org.name || '居家評鑑資料系統'}</span>
            <h1>{title}</h1>
          </div>
          {(actions || submit) && <div className="page-actions">{actions}{submit && <SubmitButton />}</div>}
        </div>
      </header>
      <main className="eval-main">{children}</main>
    </>
  )
}

/** 說明文字統一收在驚嘆號圖示裡，滑鼠移上去（或鍵盤聚焦）才顯示 */
export function Tip({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null)
  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    // 用視窗座標定位，不會被表格或卡片的捲動範圍切掉；靠近邊緣時往內收
    const width = Math.min(340, window.innerWidth - 16)
    const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8))
    setPos(r.bottom + 180 > window.innerHeight && r.top > 200 ? { left, bottom: window.innerHeight - r.top + 6, width } : { left, top: r.bottom + 6, width })
  }
  const hide = () => setPos(null)
  return (
    <span ref={ref} className="tip" tabIndex={0} role="note" aria-label="說明" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" /><path d="M12 7v6" /><path d="M12 16.6v.4" />
      </svg>
      {pos && <span className="tip-pop" style={pos}>{children}</span>}
    </span>
  )
}

export function Card({ title, children, actions, tip }: { title?: string; children: ReactNode; actions?: ReactNode; tip?: ReactNode }) {
  return (
    <section className="block">
      {(title || actions) && (
        <div className="block-head">
          {title && <h2 className="block-title">{title}{tip && <Tip>{tip}</Tip>}</h2>}
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className="block-body">{children}</div>
    </section>
  )
}

/** help＝收在驚嘆號裡的說明；note＝依資料狀況出現的提醒，直接顯示 */
export function Field({ label, children, help, note, wide }: { label: string; children: ReactNode; help?: ReactNode; note?: string; wide?: boolean }) {
  return (
    <div className={wide ? 'field wide' : 'field'}>
      <div className="field-head"><label>{label}</label>{help && <Tip>{help}</Tip>}</div>
      {children}
      {note && <div className="help">{note}</div>}
    </div>
  )
}

export function Text({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} value={value} placeholder={placeholder} {...NO_SUGGEST} onChange={(e) => onChange(e.target.value)} />
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
  return <textarea ref={ref} rows={rows} value={value} placeholder={placeholder} {...NO_SUGGEST} onChange={(e) => onChange(e.target.value)} />
}

/** 關掉瀏覽器內建的撰寫建議（Edge 的「幫我撰寫」會依頁面猜提示，常與欄位不符） */
export const NO_SUGGEST = { writingsuggestions: 'false' } as Record<string, string>

// ---------- AI ----------
/** AI 按鈕共用的狀態：處理中、錯誤訊息 */
export function useAi() {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const run = async (fn: () => Promise<void>) => {
    setErr('')
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return { busy, err, setErr, run }
}

export function AiKeyHint() {
  return getSettings().apiKey ? null : <b>尚未設定 Gemini API Key，請到首頁「AI 設定」。</b>
}

const IMPORT_SYSTEM = `你是台灣長照居家服務機構的行政助理，協助把會議或督導的錄音、掃描文件整理成評鑑用的書面紀錄。
要求：
- 只根據檔案裡實際出現的內容整理，沒有提到的欄位回傳空字串，不要推測或編造，尤其是人名、日期、數字。
- 錄音請先在心中轉成逐字稿再歸納；掃描文件請辨識文字（含手寫）後整理。
- 使用繁體中文、台灣長照用語，改寫成正式書面語，刪除口語贅字；重點條列，每項一行。
- 只輸出 JSON。`

/** 匯入錄音檔、PDF 或照片，由 AI 整理後交給 onResult 填入欄位 */
export function AiImport<T>({ prompt, onResult, tip, label = '匯入錄音／PDF，由 AI 整理' }: { prompt: string; onResult: (out: T) => void; tip?: string; label?: string }) {
  const ai = useAi()
  const fileRef = useRef<HTMLInputElement>(null)
  const pick = (file?: File) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    ai.run(async () => onResult(parseJson<T>(await generateFromFile(getSettings(), IMPORT_SYSTEM, prompt, file))))
  }
  return (
    <div className="ai-import">
      <div className="row">
        <button type="button" className="btn small ghost" disabled={ai.busy} onClick={() => fileRef.current?.click()}>
          {ai.busy ? 'AI 整理中，請稍候…' : label}
        </button>
        <Tip>可選錄音檔（mp3、m4a、wav…）、PDF 或拍照的紀錄表。檔案會送到 Gemini 辨識，整理結果填入下方欄位，可再修改。{tip}</Tip>
        <span className="help"><AiKeyHint /></span>
        <input ref={fileRef} type="file" accept="audio/*,video/mp4,application/pdf,image/*,.m4a,.mp3,.wav,.aac,.amr" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {ai.err && <div className="err">{ai.err}</div>}
    </div>
  )
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
    getPhotos(key ? key.split(',') : []).then((p) => alive && setPhotos(p)).catch(() => {})
    return () => {
      alive = false
    }
  }, [key])
  return photos
}

export function PhotoField({ ids, onChange, alt = '會議照片' }: { ids: string[]; onChange: (ids: string[]) => void; alt?: string }) {
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
            <img src={p.dataUrl} alt={alt} />
            <button type="button" className="btn tiny danger ghost" onClick={() => {
              if (!window.confirm('刪除這張照片？')) return
              // 照片檔在提交後才真的刪除（見 store 的 dropPhotos），捨棄修改時還能復原
              onChange(ids.filter((x) => x !== p.id))
            }}>刪除</button>
          </figure>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn small ghost" disabled={busy || ids.length >= MAX_PHOTOS} onClick={() => fileRef.current?.click()}>
          {busy ? '處理中…' : '＋ 上傳照片'}
        </button>
        <span className="help">{ids.length}/{MAX_PHOTOS} 張</span>
        <Tip>每筆最多 {MAX_PHOTOS} 張，上傳時會自動縮小。</Tip>
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

/** 編輯頁上方的按鈕：匯出 Word、刪除、提交 */
export function EditActions({ onWord, onDelete }: { onWord: () => void; onDelete: () => void }) {
  return (
    <>
      <button type="button" className="btn" onClick={onWord}>匯出 Word</button>
      <button type="button" className="btn danger ghost" onClick={onDelete}>刪除</button>
      <SubmitButton />
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
