import { useState } from 'react'
import { polishText, type PolishMode } from '../ai'
import { useEditor } from '../editor'
import { getPath, setPath } from '../util'


/** 顯示 AI 來源與依據 */
export function SourceTag({ metaKey }: { metaKey: string }) {
  const { plan } = useEditor()
  const [open, setOpen] = useState(false)
  const m = plan.meta[metaKey]
  if (!m || m.source !== 'transcript') return null
  return (
    <span className="src-tag-wrap">
      <span className="src-tag transcript">逐字稿依據
      </span>
      {m.evidence && (
        <button type="button" className="link" onClick={() => setOpen(!open)}>
          {open ? '收起依據' : '依據'}
        </button>
      )}
      {open && m.evidence && <span className="evidence">「{m.evidence}」</span>}
    </span>
  )
}

interface TextFieldProps {
  path: string
  label: string
  multiline?: boolean
  placeholder?: string
  required?: boolean
  help?: string
  rows?: number
}

export function TextField({ path, label, multiline, placeholder, required, help, rows = 4 }: TextFieldProps) {
  const { plan, update, locked } = useEditor()
  const value = (getPath(plan, path) as string) ?? ''
  const set = (v: string) => update((d) => setPath(d, path, v), path)
  return (
    <div className="field">
      <div className="field-head">
        <label>
          {label}
          {required && <span className="req">*</span>}
        </label>
        <SourceTag metaKey={path} />
        {multiline && !locked && <Polish path={path} label={label} value={value} />}
      </div>
      {help && <div className="help">{help}</div>}
      {multiline ? (
        <textarea value={value} rows={rows} placeholder={placeholder} disabled={locked} onChange={(e) => set(e.target.value)} />
      ) : (
        <input value={value} placeholder={placeholder} disabled={locked} onChange={(e) => set(e.target.value)} />
      )}
    </div>
  )
}

function Polish({ path, label, value }: { path: string; label: string; value: string }) {
  const { settings, update, openSettings } = useEditor()
  const [menu, setMenu] = useState(false)
  const [busy, setBusy] = useState(false)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [err, setErr] = useState('')

  async function run(mode: PolishMode) {
    setMenu(false)
    setErr('')
    let custom = ''
    if (mode === 'custom') {
      custom = window.prompt('請輸入修改指示，例如「改成三點條列」') ?? ''
      if (!custom.trim()) return
    }
    if (!settings.apiKey) return openSettings()
    setBusy(true)
    try {
      setSuggestion(await polishText(settings, value, label, mode, custom))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="polish">
      <button type="button" className="btn tiny ghost" disabled={!value.trim() || busy} onClick={() => setMenu(!menu)}>
        {busy ? 'AI 修飾中…' : 'AI 修飾 ▾'}
      </button>
      {menu && (
        <span className="menu">
          <button type="button" onClick={() => run('formal')}>更正式</button>
          <button type="button" onClick={() => run('concise')}>精簡</button>
          <button type="button" onClick={() => run('evaluation')}>評鑑用語</button>
          <button type="button" onClick={() => run('custom')}>自訂指令…</button>
        </span>
      )}
      {err && <span className="err">{err}</span>}
      {suggestion !== null && (
        <span className="suggestion">
          <strong>AI 修飾建議</strong>
          <span className="suggestion-text">{suggestion}</span>
          <span className="row">
            <button
              type="button"
              className="btn tiny ok"
              onClick={() => {
                update((d) => setPath(d, path, suggestion), path)
                setSuggestion(null)
              }}
            >
              採用
            </button>
            <button type="button" className="btn tiny ghost" onClick={() => setSuggestion(null)}>
              放棄
            </button>
          </span>
        </span>
      )}
    </span>
  )
}

export function ListField({ path, label, help }: { path: string; label: string; help?: string }) {
  const { plan, update, locked } = useEditor()
  const list = (getPath(plan, path) as string[]) ?? []
  const set = (fn: (l: string[]) => void) =>
    update((d) => {
      const l = [...(getPath(d, path) as string[])]
      fn(l)
      setPath(d, path, l)
    }, path)
  return (
    <div className="field">
      <div className="field-head">
        <label>{label}</label>
        <SourceTag metaKey={path} />
      </div>
      {help && <div className="help">{help}</div>}
      {list.map((v, i) => (
        <div className="list-row" key={i}>
          <span className="idx">{i + 1}.</span>
          <input value={v} disabled={locked} onChange={(e) => set((l) => (l[i] = e.target.value))} />
          {!locked && (
            <button type="button" className="icon" title="刪除" onClick={() => set((l) => l.splice(i, 1))}>
              ✕
            </button>
          )}
        </div>
      ))}
      {!locked && (
        <button type="button" className="btn tiny ghost" onClick={() => set((l) => l.push(''))}>
          + 新增{label}
        </button>
      )}
    </div>
  )
}
