import { useState } from 'react'
import { listModels } from '../gemini'
import { DEFAULT_MODEL, saveSettings } from '../storage'
import type { Settings } from '../types'

export function SettingsModal({ settings, onClose }: { settings: Settings; onClose: (s: Settings) => void }) {
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [model, setModel] = useState(settings.model)
  const [show, setShow] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [msg, setMsg] = useState('')

  const save = () => {
    const s = { apiKey: apiKey.trim(), model: model.trim() || DEFAULT_MODEL }
    saveSettings(s)
    onClose(s)
  }

  const test = async () => {
    setMsg('連線中…')
    try {
      const list = await listModels(apiKey.trim())
      // 只列可產生文字的模型，排除語音、圖片、機器人等特殊用途
      const usable = list
        .filter((m) => m.startsWith('gemini') && !/tts|image|banana|robotics|computer-use|transcribe|customtools/.test(m))
        .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
      setModels(usable)
      setMsg(`連線成功，點選下方模型即可套用（共 ${usable.length} 個可用於填表）。`)
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  return (
    <div className="modal-bg" onClick={() => onClose(settings)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>AI 設定</h3>
        <div className="field">
          <label>Gemini API Key</label>
          <div className="row">
            <input type={show ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIza…" />
            <button type="button" className="btn small ghost" onClick={() => setShow(!show)}>{show ? '隱藏' : '顯示'}</button>
          </div>
          <div className="help">
            到 Google AI Studio 取得金鑰。金鑰只存在這台電腦的瀏覽器裡，不會上傳到其他地方。
            <b>共用電腦請用完後按「清除金鑰」。</b>
          </div>
        </div>
        <div className="field">
          <label>模型</label>
          <div className="row">
            <input value={model} onChange={(e) => setModel(e.target.value)} />
            <button type="button" className="btn small ghost" disabled={!apiKey.trim()} onClick={test}>測試連線並列出模型</button>
          </div>
          {models.length > 0 && (
            <div className="model-list">
              {models.map((m) => (
                <button type="button" key={m} className={m === model ? 'on' : ''} onClick={() => setModel(m)}>
                  {m}
                  {m.includes('lite') && <span className="chip info">lite</span>}
                </button>
              ))}
            </div>
          )}
          <div className="help">預設 {DEFAULT_MODEL}。{msg}</div>
        </div>
        <div className="row between">
          <button type="button" className="btn danger ghost" onClick={() => {
            const s = { apiKey: '', model: model.trim() || DEFAULT_MODEL }
            saveSettings(s)
            onClose(s)
          }}>清除金鑰</button>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => onClose(settings)}>取消</button>
            <button type="button" className="btn primary" onClick={save}>儲存</button>
          </div>
        </div>
      </div>
    </div>
  )
}
