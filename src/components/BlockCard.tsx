import { useState } from 'react'
import type { BlockDef } from '../blocks'
import { useEditor } from '../editor'
import { BLOCK_BODY } from './BlockBodies'

export function BlockCard({ block, index }: { block: BlockDef; index: number }) {
  const { plan, aiStatus } = useEditor()
  const [open, setOpen] = useState(block.phase === 'plan')
  const missing = block.missing(plan)
  const status = aiStatus[block.id] ?? { state: 'idle' }
  const Body = BLOCK_BODY[block.id]
  const done = block.counted ? missing.length === 0 : null

  return (
    <section className="block" id={`block-${block.id}`}>
      <header className="block-head">
        <button type="button" className="block-toggle" onClick={() => setOpen(!open)}>
          <span className="block-no">區塊 {index}</span>
          <span className="block-title">{block.no}、{block.title}</span>
          {done === null ? (
            <span className="chip muted">年度執行後回填</span>
          ) : (
            <span className={done ? 'chip ok' : 'chip warn'}>{done ? '已完成' : '未完成'}</span>
          )}
          <span className="caret">{open ? '收合' : '展開'}</span>
        </button>
      </header>
      <p className="block-desc">{block.desc}</p>
      {missing.length > 0 && <p className="missing">尚缺：{missing.join('／')}</p>}
      {status.state === 'running' && <p className="ai-done">AI 處理中…</p>}
      {status.state === 'error' && <p className="err">{status.msg}</p>}
      {status.state === 'done' && <p className="ai-done">{status.msg}</p>}
      {open && (
        <div className="block-body">
          <Body />
        </div>
      )}
    </section>
  )
}
