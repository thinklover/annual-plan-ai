import { useState, type ReactNode } from 'react'
import { SettingsModal } from '../../components/SettingsModal'
import { getSettings } from '../../storage'
import { useStore } from '../store'
import type { Org } from '../types'
import { Area, DateIn, Field, Text } from '../ui'

// 線條圖示（24×24，stroke 使用 currentColor）
const I = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)
const ICONS = {
  staff: I(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.6c2.8 0 5 1.8 5 4.6" /></>),
  chart: I(<><path d="M4 20V4" /><path d="M4 20h16" /><rect x="7" y="11" width="3" height="6" /><rect x="12" y="7" width="3" height="10" /><rect x="17" y="13" width="3" height="4" /></>),
  plan: I(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /><path d="M8 14h3M8 17h6" /></>),
  meeting: I(<><path d="M4 5h16v10H9l-4 4v-4H4z" /><path d="M8 9h8M8 12h5" /></>),
  group: I(<><circle cx="12" cy="7" r="3" /><circle cx="5" cy="10" r="2.2" /><circle cx="19" cy="10" r="2.2" /><path d="M7 20c0-3 2.2-5 5-5s5 2 5 5" /><path d="M2 18c0-2 1.3-3.5 3-3.7M22 18c0-2-1.3-3.5-3-3.7" /></>),
  person: I(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /><path d="M16.5 4.5l1.5 1.5 3-3" /></>),
  alert: I(<><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17h.01" /></>),
  case: I(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M12 11v5M9.5 13.5h5" /></>),
  voice: I(<><path d="M4 4h16v12H8l-4 4z" /><path d="M12 7v4M12 13.5h.01" /></>),
  smile: I(<><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8" /><path d="M9 9.5h.01M15 9.5h.01" /></>),
}

interface Item { title: string; desc: string; icon: keyof typeof ICONS; tone: string; href?: string }
const ITEMS: Item[] = [
  { title: '員工名冊', desc: '基本資料、體檢、特殊訓練與訓練時數總表', icon: 'staff', tone: 'teal', href: '#/staff' },
  { title: '服務量能', desc: '每月個案數、申報與人力異動', icon: 'chart', tone: 'teal', href: '#/capacity' },
  { title: '年度業務計畫', desc: '年初計畫、年中檢討、年終成果', icon: 'plan', tone: 'blue', href: '#/plan' },
  { title: '行政會議', desc: '會議紀錄與年度總表', icon: 'meeting', tone: 'blue', href: '#/meetings/admin' },
  { title: '團體督導會議', desc: '會議紀錄與年度總表', icon: 'group', tone: 'blue', href: '#/meetings/group' },
  { title: '個別督導紀錄', desc: '個督紀錄與年度總表', icon: 'person', tone: 'blue', href: '#/supervision' },
  { title: '意外或緊急事件', desc: '事件紀錄、年度分析與改善', icon: 'alert', tone: 'amber', href: '#/incidents/accident' },
  { title: '個案討論會', desc: '會議紀錄與年度總表', icon: 'case', tone: 'amber', href: '#/casemeet' },
  { title: '意見反映或申訴', desc: '事件紀錄、年度分析與改善', icon: 'voice', tone: 'amber', href: '#/incidents/complaint' },
  { title: '服務滿意度調查', desc: '建置中', icon: 'smile', tone: 'gray' },
]

const ORG_FIELDS: [keyof Org, string, boolean][] = [
  ['name', '機構全銜', false],
  ['address', '設立地址', false],
  ['foundedDate', '設立日期', false],
  ['vision', '願景', true],
  ['philosophy', '理念', true],
  ['mission', '使命', true],
]

function OrgModal({ onClose }: { onClose: () => void }) {
  const { data, update } = useStore()
  const set = (k: keyof Org, v: string) => update((d) => { (d.org[k] as string) = v })
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal org-modal" onClick={(e) => e.stopPropagation()}>
        <h3>機構設定</h3>
        <div className="grid2">
          {ORG_FIELDS.map(([k, label, long]) => (
            <Field key={k} label={label} wide={long || k === 'name'}>
              {k === 'foundedDate'
                ? <DateIn value={data.org[k]} onChange={(v) => set(k, v)} />
                : long ? <Area value={data.org[k]} onChange={(v) => set(k, v)} rows={2} /> : <Text value={data.org[k]} onChange={(v) => set(k, v)} />}
            </Field>
          ))}
          <Field label="年份格式" help="影響所有畫面、Word 與 Excel 的日期和年度。" wide>
            <div className="seg">
              {(['roc', 'ad'] as const).map((f) => (
                <button type="button" key={f} className={data.org.yearFormat === f ? 'on' : ''} onClick={() => update((d) => { d.org.yearFormat = f })}>
                  {f === 'roc' ? '民國（114.07.30）' : '西元（2025.07.30）'}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <span className="help">自動儲存</span>
          <button type="button" className="btn primary" onClick={onClose}>完成</button>
        </div>
      </div>
    </div>
  )
}

export function Home() {
  const { data } = useStore()
  const [showOrg, setShowOrg] = useState(false)
  const [settings, setSettings] = useState(getSettings)
  const [showAi, setShowAi] = useState(false)
  const o = data.org

  return (
    <div className="eval-home">
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <span className="hero-kicker">居家評鑑資料系統</span>
            <h1>{o.name || '尚未設定機構'}</h1>
            {o.vision ? <p>{o.vision}</p> : <p>評鑑資料建置、紀錄與年度總表，一處完成。</p>}
          </div>
          <div className="hero-actions">
            <button type="button" className="btn hero-btn" onClick={() => setShowOrg(true)}>機構設定</button>
            <button type="button" className="btn hero-btn ghost" onClick={() => setShowAi(true)}>
              AI 設定{!settings.apiKey && <span className="hero-dot" title="尚未設定金鑰" />}
            </button>
          </div>
        </div>
      </header>

      <main className="home-body">
        {!o.name && (
          <button type="button" className="setup-tip" onClick={() => setShowOrg(true)}>
            <b>先完成機構設定</b>
            <span>填寫機構全銜、願景、理念與使命，Word 與 Excel 的抬頭會自動帶入。</span>
            <span className="setup-go">前往設定 →</span>
          </button>
        )}

        <div className="tiles">
          {ITEMS.map((it) => {
            const body = (
              <>
                <span className={`tile-icon ${it.tone}`}>{ICONS[it.icon]}</span>
                <span className="tile-text">
                  <b>{it.title}</b>
                  <span className="tile-desc">{it.desc}</span>
                </span>
              </>
            )
            return it.href
              ? <a key={it.title} className="tile" href={it.href}>{body}</a>
              : <div key={it.title} className="tile off">{body}</div>
          })}
        </div>

        <p className="home-foot">資料只存在這台電腦的瀏覽器中，請勿清除瀏覽器資料。</p>
      </main>

      {showOrg && <OrgModal onClose={() => setShowOrg(false)} />}
      {showAi && <SettingsModal settings={settings} onClose={(s) => { setSettings(s); setShowAi(false) }} />}
    </div>
  )
}
