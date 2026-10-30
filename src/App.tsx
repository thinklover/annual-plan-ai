import { useCallback, useState } from 'react'
import { Editor } from './components/Editor'
import { PlanList } from './components/PlanList'
import { SettingsModal } from './components/SettingsModal'
import { getPlan, getSettings } from './storage'
import type { Plan } from './types'

export default function App() {
  const [settings, setSettings] = useState(getSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [current, setCurrent] = useState<Plan | null>(null)
  const openSettings = useCallback(() => setShowSettings(true), [])

  return (
    <>
      {current ? (
        <Editor key={current.id} initial={current} settings={settings} openSettings={openSettings} onBack={() => setCurrent(null)} />
      ) : (
        <PlanList onOpen={(p) => setCurrent(getPlan(p.id) ?? p)} onSettings={openSettings} hasKey={!!settings.apiKey} />
      )}
      {showSettings && (
        <SettingsModal settings={settings} onClose={(s) => { setSettings(s); setShowSettings(false) }} />
      )}
    </>
  )
}
