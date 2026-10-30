import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { buildPlanDoc, type DocNode } from '../planDoc'
import type { Plan } from '../types'

function Node({ n }: { n: DocNode }) {
  if (n.t === 'h3') return <h4>{n.text}</h4>
  if (n.t === 'p') return <p>{n.text}</p>
  return (
    <table>
      <thead>
        <tr>{n.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {n.rows.length ? (
          n.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)
        ) : (
          <tr><td colSpan={n.headers.length} className="empty">（未填寫）</td></tr>
        )}
      </tbody>
    </table>
  )
}

/** 年度業務計畫書預覽：內容與 Word 匯出相同 */
export function PreviewModal({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const doc = useMemo(() => buildPlanDoc(plan), [plan])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="preview-bg" onClick={onClose}>
      <div className="preview" onClick={(e) => e.stopPropagation()}>
        <header className="preview-head">
          <strong>年度業務計畫書預覽</strong>
          <div className="row">
            <button type="button" className="btn ghost small" onClick={() => window.print()}>列印／另存 PDF</button>
            <button type="button" className="btn small" onClick={onClose}>關閉</button>
          </div>
        </header>
        <article className="paper">
          <div className="cover">
            <div className="org">{doc.orgName}</div>
            <h2>{doc.yearLine}</h2>
            <div>{doc.madeLine}</div>
          </div>
          {doc.sections.map((s) => (
            <section key={s.id}>
              <h3>{s.heading}</h3>
              {s.nodes.length ? s.nodes.map((n, i) => <Node key={i} n={n} />) : <p className="empty">（未填寫）</p>}
            </section>
          ))}
        </article>
      </div>
    </div>,
    document.body,
  )
}
