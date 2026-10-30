/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from 'react'
import { ROW_FACTORY } from '../defaults'
import { useEditor } from '../editor'
import { getPath, setPath } from '../util'
import { SourceTag } from './Field'

export interface TCol {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'months' | 'number' | 'bool' | 'select'
  options?: string[]
  readOnly?: boolean
  width?: string
  /** 計算欄位：不存資料，只顯示 */
  render?: (row: any) => ReactNode
  /** 輸入框提示文字（可依列計算，例如預設目標值） */
  placeholder?: (row: any) => string
}

interface Props {
  path: string
  metaKey: string
  cols: TCol[]
  title?: string
  /** 結果類表格：列由其他區塊帶入，不能新增刪除 */
  fixedRows?: boolean
  sortable?: boolean
  addLabel?: string
  empty?: string
  footer?: ReactNode
}

export function MonthPicker({ value, onChange, disabled }: { value: number[]; onChange: (v: number[]) => void; disabled?: boolean }) {
  return (
    <div className="months">
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
        const on = value.includes(m)
        return (
          <button
            type="button"
            key={m}
            className={on ? 'm on' : 'm'}
            disabled={disabled}
            onClick={() => onChange(on ? value.filter((x) => x !== m) : [...value, m].sort((a, b) => a - b))}
          >
            {m}
          </button>
        )
      })}
    </div>
  )
}

export function TableEditor({ path, metaKey, cols, title, fixedRows, sortable, addLabel = '新增一列', empty, footer }: Props) {
  const { plan, update, locked } = useEditor()
  const rows = (getPath(plan, path) as any[]) ?? []
  const mutate = (fn: (rows: any[]) => void) =>
    update((d) => {
      const r = [...(getPath(d, path) as any[])].map((x) => ({ ...x }))
      fn(r)
      setPath(d, path, r)
    }, metaKey)

  const cell = (row: any, i: number, c: TCol) => {
    if (c.render) return c.render(row)
    const v = row[c.key]
    const set = (val: unknown) => mutate((r) => (r[i][c.key] = val))
    const dis = locked || c.readOnly
    switch (c.type) {
      case 'months':
        return <MonthPicker value={v ?? []} disabled={dis} onChange={set} />
      case 'bool':
        return <input type="checkbox" checked={!!v} disabled={dis} onChange={(e) => set(e.target.checked)} />
      case 'textarea':
        return <textarea rows={2} value={v ?? ''} disabled={dis} onChange={(e) => set(e.target.value)} />
      case 'select':
        return (
          <select value={v ?? ''} disabled={dis} onChange={(e) => set(e.target.value)}>
            <option value="">（無上層）</option>
            {(c.options ?? []).filter((o) => o && o !== row.name).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        )
      default:
        return c.readOnly ? (
          <span className="ro">{v}</span>
        ) : (
          <input
            value={v ?? ''}
            placeholder={c.placeholder?.(row)}
            inputMode={c.type === 'number' ? 'numeric' : undefined}
            disabled={dis}
            onChange={(e) => set(e.target.value)}
          />
        )
    }
  }

  return (
    <div className="field">
      <div className="field-head">
        {title && <label>{title}</label>}
        <SourceTag metaKey={metaKey} />
      </div>
      {rows.length === 0 ? (
        <div className="empty">{empty ?? '尚無資料。'}</div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th className="no">#</th>
                {cols.map((c) => (
                  <th key={c.key} style={c.width ? { width: c.width } : undefined}>{c.label}</th>
                ))}
                {!fixedRows && !locked && <th className="ops" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id}>
                  <td className="no">{i + 1}</td>
                  {cols.map((c) => (
                    <td key={c.key}>{cell(row, i, c)}</td>
                  ))}
                  {!fixedRows && !locked && (
                    <td className="ops">
                      {sortable && (
                        <>
                          <button type="button" className="icon" disabled={i === 0} title="上移"
                            onClick={() => mutate((r) => r.splice(i - 1, 0, r.splice(i, 1)[0]))}>↑</button>
                          <button type="button" className="icon" disabled={i === rows.length - 1} title="下移"
                            onClick={() => mutate((r) => r.splice(i + 1, 0, r.splice(i, 1)[0]))}>↓</button>
                        </>
                      )}
                      <button type="button" className="icon" title="刪除" onClick={() => mutate((r) => r.splice(i, 1))}>✕</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {footer}
          </table>
        </div>
      )}
      {!fixedRows && !locked && (
        <button type="button" className="btn tiny ghost" onClick={() => mutate((r) => r.push(ROW_FACTORY[path]()))}>
          + {addLabel}
        </button>
      )}
    </div>
  )
}
