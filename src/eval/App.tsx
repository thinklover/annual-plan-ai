import { useEffect, useState } from 'react'
import { AnnualPlanPage } from './pages/AnnualPlan'
import { CapacityPage } from './pages/Capacity'
import { CaseMeetingEdit, CaseMeetingList } from './pages/CaseMeetings'
import { Home } from './pages/Home'
import { IncidentEdit, IncidentList, IncidentReportPage } from './pages/Incidents'
import { MeetingEdit, MeetingList } from './pages/Meetings'
import { StaffPage } from './pages/Staff'
import { SupervisionEdit, SupervisionList } from './pages/Supervision'
import { Gate } from './Gate'
import { useStore } from './store'
import type { IncidentKind, MeetingKind } from './types'
import { Building, YearProvider } from './ui'

function useHash() {
  const [hash, setHash] = useState(() => location.hash)
  const { leave } = useStore()
  useEffect(() => {
    const on = (e: HashChangeEvent) => {
      // 有修改尚未提交又不想離開：退回原本的頁面
      if (!leave()) return location.replace(e.oldURL)
      setHash(location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [leave])
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

function Route() {
  const [a, b, c] = useHash()
  switch (a) {
    case 'staff': return <StaffPage />
    case 'capacity': return <CapacityPage />
    case 'plan': return <AnnualPlanPage />
    case 'meetings':
      if (b !== 'admin' && b !== 'group') break
      return c ? <MeetingEdit key={c} kind={b as MeetingKind} id={c} /> : <MeetingList kind={b as MeetingKind} />
    case 'supervision': return b ? <SupervisionEdit key={b} id={b} /> : <SupervisionList />
    case 'incidents':
      if (b !== 'accident' && b !== 'complaint') break
      if (c === 'report') return <IncidentReportPage kind={b as IncidentKind} />
      return c ? <IncidentEdit key={c} kind={b as IncidentKind} id={c} /> : <IncidentList kind={b as IncidentKind} />
    case 'casemeet': return b ? <CaseMeetingEdit key={b} id={b} /> : <CaseMeetingList />
    case 'satisfaction': return <Building title="3-4 服務滿意度調查" />
  }
  return <Home />
}

export default function App() {
  return (
    <Gate>
      <YearProvider>
        <Route />
      </YearProvider>
    </Gate>
  )
}
