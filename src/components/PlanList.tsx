import { useRef, useState } from 'react'
import { completion } from '../blocks'
import { emptyPlan, makeTitle } from '../defaults'
import { deletePlan, importPlan, listPlans, savePlan } from '../storage'
import type { Plan } from '../types'

export function PlanList({ onOpen, onSettings, hasKey }: { onOpen: (p: Plan) => void; onSettings: () => void; hasKey: boolean }) {
  const [plans, setPlans] = useState(listPlans)
  const fileRef = useRef<HTMLInputElement>(null)

  const create = () => {
    const p = emptyPlan()
    savePlan(p)
    onOpen(p)
  }

  const onImport = async (f: File | undefined) => {
    if (!f) return
    try {
      onOpen(importPlan(await f.text()))
    } catch (e) {
      window.alert(`匯入失敗：${(e as Error).message}`)
    }
  }

  return (
    <div className="home">
      <header className="home-head">
        <div>
          <h1>年度業務計畫書 AI 填表</h1>
          <p>依評鑑基準 A1 格式，貼上訪談逐字稿，由 AI 協助填寫年度業務計畫書。</p>
        </div>
        <button type="button" className="btn ghost" onClick={onSettings}>{hasKey ? 'AI 設定' : 'AI 設定（尚未設定金鑰）'}</button>
      </header>
      <div className="row">
        <button type="button" className="btn primary" onClick={create}>+ 新增計畫書</button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>匯入 JSON</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
      </div>
      <p className="help">資料只存在這台電腦的瀏覽器中，換電腦或清除瀏覽器資料前，請先在計畫書內「匯出 JSON」備份。</p>
      {plans.length === 0 ? (
        <div className="empty big">還沒有計畫書，按「新增計畫書」開始。</div>
      ) : (
        <table className="grid plans">
          <thead>
            <tr><th>計畫書</th><th>狀態</th><th>完成率</th><th>最後修改</th><th /></tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td><button type="button" className="link strong" onClick={() => onOpen(p)}>{p.basic.title.trim() || makeTitle(p)}</button></td>
                <td>{p.submitted ? <span className="chip ok">已提交</span> : <span className="chip warn">編輯中</span>}</td>
                <td>{completion(p)}%</td>
                <td>{new Date(p.updatedAt).toLocaleString('zh-TW')}</td>
                <td>
                  <button type="button" className="btn tiny danger ghost" onClick={() => {
                    if (!window.confirm('確定刪除這份計畫書？刪除後無法復原（建議先匯出 JSON）。')) return
                    deletePlan(p.id)
                    setPlans(listPlans())
                  }}>刪除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
