import { createContext, useContext } from 'react'
import type { FillMode } from './ai'
import type { Plan, Settings } from './types'

export type AiStatus = { state: 'idle' } | { state: 'running' } | { state: 'done'; msg: string } | { state: 'error'; msg: string }

export interface EditorCtx {
  plan: Plan
  locked: boolean
  settings: Settings
  /** 修改計畫書；傳入 metaKey 表示人工修改，該欄位的 AI 標記會清除 */
  update: (fn: (d: Plan) => void, metaKey?: string) => void
  confirm: (keys: string[]) => void
  aiStatus: Record<string, AiStatus>
  runAi: (blockId: string, mode: FillMode) => Promise<void>
  openSettings: () => void
}

export const Ctx = createContext<EditorCtx | null>(null)

export function useEditor() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useEditor 必須在編輯器內使用')
  return c
}
