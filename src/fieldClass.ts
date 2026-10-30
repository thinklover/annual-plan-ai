import type { Plan } from './types'

/** 依 AI 來源與確認狀態決定欄位底色 */
export function fieldClass(metaKey: string, meta: Plan['meta']) {
  const m = meta[metaKey]
  if (!m || m.confirmed) return 'field'
  if (m.source === 'transcript') return 'field src-transcript'
  if (m.source === 'ai_guess') return 'field src-guess'
  return 'field'
}
