import { useState } from 'react'
import { blockById, type Phase } from '../blocks'
import { useEditor } from '../editor'
import { SCRIPTS } from '../scripts'

interface Props {
  onFillAll: (phase: Phase) => void
  fillingAll: boolean
}

export function InterviewPanel({ onFillAll, fillingAll }: Props) {
  const { plan, update, locked } = useEditor()
  const [phase, setPhase] = useState<Phase>('plan')
  const [tab, setTab] = useState<'transcript' | 'script'>('transcript')
  const script = SCRIPTS.find((s) => s.phase === phase)!
  const transcript = plan.transcripts[phase]
  const asked = script.questions.filter((q) => plan.scriptChecks[q.id]).length

  return (
    <section className="panel">
      <div className="panel-tabs">
        <div className="seg">
          <button type="button" className={phase === 'plan' ? 'on' : ''} onClick={() => setPhase('plan')}>年初計畫訪談（壹～拾陸）</button>
          <button type="button" className={phase === 'review' ? 'on' : ''} onClick={() => setPhase('review')}>年終成果訪談（拾柒～貳拾）</button>
        </div>
        <div className="seg">
          <button type="button" className={tab === 'transcript' ? 'on' : ''} onClick={() => setTab('transcript')}>逐字稿</button>
          <button type="button" className={tab === 'script' ? 'on' : ''} onClick={() => setTab('script')}>
            訪談講稿（{asked}/{script.questions.length}）
          </button>
        </div>
      </div>

      {tab === 'transcript' ? (
        <div className="transcript">
          <textarea
            rows={10}
            value={transcript}
            disabled={locked}
            placeholder={'請貼上訪談逐字稿，建議標示說話者，例如：\n訪談員：請問機構的全名是？\n受訪者：我們是○○社區式長照機構……'}
            onChange={(e) => update((d) => { d.transcripts[phase] = e.target.value })}
          />
          <div className="row between">
            <span className="help">{transcript.length.toLocaleString()} 字</span>
            {!locked && (
              <button type="button" className="btn primary" disabled={!transcript.trim() || fillingAll} onClick={() => onFillAll(phase)}>
                {fillingAll ? 'AI 填寫中…' : `AI 全部填寫（${phase === 'plan' ? '年初計畫各區' : '年終成果各區'}）`}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="script">
          <div className="row between">
            <strong>{script.title}</strong>
            <button type="button" className="btn small ghost" onClick={async () => (await import('../exportDocx')).exportScriptDocx(script, plan)}>匯出講稿 Word</button>
          </div>
          <ul className="script-intro">
            {script.intro.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <ol className="questions">
            {script.questions.map((q) => {
              const b = blockById(q.block)
              return (
                <li key={q.id} className={plan.scriptChecks[q.id] ? 'asked' : ''}>
                  <label>
                    <input type="checkbox" checked={!!plan.scriptChecks[q.id]} disabled={locked}
                      onChange={(e) => update((d) => { d.scriptChecks[q.id] = e.target.checked })} />
                    <span>
                      <span className="q-block">{b.no}、{b.title}</span>
                      {q.q}
                      {q.tip && <span className="q-tip">提示：{q.tip}</span>}
                    </span>
                  </label>
                </li>
              )
            })}
          </ol>
          <ul className="script-intro">
            {script.outro.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}
