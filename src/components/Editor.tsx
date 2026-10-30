import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { applyAi, runBlockAi } from '../ai'
import { BLOCKS, blockById, completion, type Phase } from '../blocks'
import { makeTitle } from '../defaults'
import { Ctx, type AiStatus, type EditorCtx } from '../editor'
import { savePlan } from '../storage'
import type { Plan, Settings } from '../types'
import { download, pool } from '../util'
import { BlockCard } from './BlockCard'
import { InterviewPanel } from './InterviewPanel'
import { PreviewModal } from './PreviewModal'

interface Props {
  initial: Plan
  settings: Settings
  openSettings: () => void
  onBack: () => void
}

export function Editor({ initial, settings, openSettings, onBack }: Props) {
  const [plan, setPlan] = useState(initial)
  const [aiStatus, setAiStatus] = useState<Record<string, AiStatus>>({})
  const [fillingAll, setFillingAll] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [savedPlan, setSavedPlan] = useState(initial)
  const saved = savedPlan === plan
  const planRef = useRef(plan)
  useLayoutEffect(() => {
    planRef.current = plan
  }, [plan])

  // 自動儲存（停止輸入 0.6 秒後寫入 localStorage）
  useEffect(() => {
    const t = setTimeout(() => {
      savePlan(plan)
      setSavedPlan(plan)
    }, 600)
    return () => clearTimeout(t)
  }, [plan])

  // 離開編輯器時立即儲存
  useEffect(() => () => savePlan(planRef.current), [])

  const locked = plan.submitted

  const update = useCallback<EditorCtx['update']>((fn, metaKey) => {
    setPlan((prev) => {
      if (prev.submitted) return prev
      const d = structuredClone(prev)
      fn(d)
      if (metaKey) delete d.meta[metaKey]
      d.updatedAt = new Date().toISOString()
      return d
    })
  }, [])

  const runAi = useCallback(async (blockId: string) => {
    if (!settings.apiKey) {
      openSettings()
      return
    }
    const block = blockById(blockId)
    const snapshot = planRef.current
    const transcript = block.phase === 'plan' ? snapshot.transcripts.plan : snapshot.transcripts.review
    setAiStatus((s) => ({ ...s, [blockId]: { state: 'running' } }))
    try {
      const result = await runBlockAi(settings, snapshot, block, transcript)
      // 以最新狀態套用（多區塊並行時不互相覆蓋）；寫入數以目前畫面狀態估算
      const { written } = applyAi(planRef.current, block, result)
      setPlan((prev) => applyAi(prev, block, result).plan)
      const msg = written
        ? `AI 已填寫 ${written} 個欄位，可點欄位旁的「依據」抽查。`
        : '逐字稿中沒有找到本區可用的內容（或欄位已由人工填寫）。'
      setAiStatus((s) => ({ ...s, [blockId]: { state: 'done', msg } }))
    } catch (e) {
      setAiStatus((s) => ({ ...s, [blockId]: { state: 'error', msg: (e as Error).message } }))
    }
  }, [settings, openSettings])

  const fillAll = async (phase: Phase) => {
    if (!settings.apiKey) return openSettings()
    setFillingAll(true)
    const ids = BLOCKS.filter((b) => b.phase === phase && b.fields.length).map((b) => b.id)
    await pool(ids, 4, (id) => runAi(id))
    setFillingAll(false)
  }

  const pct = completion(plan)

  const submit = () => {
    if (pct < 100 && !window.confirm(`年度計畫完成率為 ${pct}%，仍有未完成區塊，確定要提交定稿嗎？`)) return
    setPlan((p) => ({ ...p, submitted: true, updatedAt: new Date().toISOString() }))
  }

  const unlock = () => {
    if (window.confirm('解除鎖定後可以再編輯，確定嗎？')) setPlan((p) => ({ ...p, submitted: false }))
  }

  const title = plan.basic.title.trim() || makeTitle(plan)
  const ctx = useMemo<EditorCtx>(
    () => ({ plan, locked, settings, update, aiStatus, openSettings }),
    [plan, locked, settings, update, aiStatus, openSettings],
  )

  return (
    <Ctx.Provider value={ctx}>
      <div className="editor">
        <header className="topbar">
          <button type="button" className="btn ghost small" onClick={onBack}>← 計畫書清單</button>
          <div className="topbar-title">
            <h1>{title}</h1>
            <div className="chips">
              {locked ? <span className="chip ok">已提交定稿（鎖定）</span> : <span className="chip warn">編輯中</span>}
              <span className="chip">完成率 {pct}%</span>
              <span className="chip muted">{saved ? '已自動儲存' : '儲存中…'}</span>
            </div>
          </div>
          <div className="topbar-actions">
            <button type="button" className="btn ghost small" onClick={openSettings}>
              {settings.apiKey ? 'AI 設定' : 'AI 設定（尚未設定金鑰）'}
            </button>
            <button type="button" className="btn ghost small"
              onClick={() => download(`${title}.json`, new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }))}>
              匯出 JSON
            </button>
            <button type="button" className="btn ghost small" onClick={() => setPreviewing(true)}>預覽計畫書</button>
            {locked ? (
              <>
                <button type="button" className="btn ghost small" onClick={unlock}>解除鎖定</button>
                <button type="button" className="btn primary small" onClick={async () => (await import('../exportDocx')).exportPlanDocx(plan)}>匯出 Word</button>
              </>
            ) : (
              <button type="button" className="btn primary small" onClick={submit}>提交定稿</button>
            )}
          </div>
        </header>
        {previewing && <PreviewModal plan={plan} onClose={() => setPreviewing(false)} />}

        <div className="layout">
          <nav className="toc">
            {BLOCKS.map((b) => {
              const done = b.counted ? b.missing(plan).length === 0 : null
              return (
                <a key={b.id} href={`#block-${b.id}`}
                  onClick={(e) => { e.preventDefault(); document.getElementById(`block-${b.id}`)?.scrollIntoView({ behavior: 'smooth' }) }}>
                  <span className={`dot ${done === null ? 'muted' : done ? 'ok' : 'warn'}`} />
                  {b.no}、{b.title}
                </a>
              )
            })}
            <div className="legend">
              <div><span className="dot ok" />已完成</div>
              <div><span className="dot warn" />未完成</div>
              <div><span className="sw transcript" />逐字稿依據</div>
            </div>
          </nav>
          <main className="content">
            <InterviewPanel onFillAll={fillAll} fillingAll={fillingAll} />
            {BLOCKS.map((b, i) => <BlockCard key={b.id} block={b} index={i} />)}
          </main>
        </div>
      </div>
    </Ctx.Provider>
  )
}
