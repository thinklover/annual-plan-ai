// 雲端資料庫（Supabase）存取層：登入、文字資料、照片都經過這裡。
// 資料表與存取規則見 supabase/schema.sql；每個登入帳號只能讀寫自己的資料。
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tknegkfbtjmaevvcvpbf.supabase.co'
/**
 * Supabase 的 publishable（anon）金鑰。這把金鑰本來就是給瀏覽器用的，可以公開；
 * 資料靠登入與資料列權限（RLS）保護。資料庫密碼、service_role 金鑰絕對不能放進前端。
 */
const SUPABASE_KEY = 'sb_publishable_728QCXodwtgV8Z-79GGeJA_D_LaMX5e'

export const dbConfigured = !!SUPABASE_KEY
const client: SupabaseClient | null = dbConfigured ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

function sb(): SupabaseClient {
  if (!client) throw new Error('尚未設定資料庫金鑰。')
  return client
}

// ---------- 登入 ----------
export interface Account {
  id: string
  email: string
}

/** 目前登入的帳號；登入、登出時通知。回傳取消訂閱的函式 */
export function watchAccount(on: (a: Account | null) => void): () => void {
  const emit = (u?: { id: string; email?: string } | null) => on(u ? { id: u.id, email: u.email ?? '' } : null)
  sb().auth.getSession().then(({ data }) => emit(data.session?.user))
  const { data } = sb().auth.onAuthStateChange((_e, s) => emit(s?.user))
  return () => data.subscription.unsubscribe()
}

export async function signIn(email: string, password: string) {
  const { error } = await sb().auth.signInWithPassword({ email, password })
  if (!error) return
  throw new Error(/invalid login/i.test(error.message) ? '帳號或密碼錯誤。' : `登入失敗：${error.message}`)
}

export const signOut = () => sb().auth.signOut()

// ---------- 文字資料 ----------
export interface DocChange {
  /** 讀取時的版本號；0＝資料庫還沒有這個區塊 */
  version: number
  data: unknown
}

/** 別人（或另一個分頁）先提交了同一個區塊 */
export class ConflictError extends Error {}

export async function loadDocs(): Promise<{ docs: Record<string, unknown>; versions: Record<string, number> }> {
  const { data, error } = await sb().from('eval_docs').select('key, data, version')
  if (error) throw new Error(error.message)
  const docs: Record<string, unknown> = {}
  const versions: Record<string, number> = {}
  for (const r of data ?? []) {
    docs[r.key] = r.data
    versions[r.key] = r.version
  }
  return { docs, versions }
}

/** 一次交易內寫入多個區塊，回傳所有區塊的新版本號 */
export async function saveDocs(changes: Record<string, DocChange>): Promise<Record<string, number>> {
  const { data, error } = await sb().rpc('eval_save', { changes })
  if (error) {
    if (error.message.includes('conflict:')) throw new ConflictError(error.message)
    throw new Error(error.message)
  }
  return data as Record<string, number>
}

// ---------- 照片 ----------
export interface PhotoRow {
  id: string
  dataUrl: string
  w: number
  h: number
}

export async function insertPhoto(p: PhotoRow) {
  const { error } = await sb().from('eval_photos').insert({ id: p.id, data_url: p.dataUrl, w: p.w, h: p.h })
  if (error) throw new Error(`照片上傳失敗：${error.message}`)
}

export async function selectPhotos(ids: string[]): Promise<PhotoRow[]> {
  if (!ids.length) return []
  const { data, error } = await sb().from('eval_photos').select('id, data_url, w, h').in('id', ids)
  if (error) throw new Error(`照片讀取失敗：${error.message}`)
  return (data ?? []).map((r) => ({ id: r.id, dataUrl: r.data_url, w: r.w, h: r.h }))
}

export async function removePhoto(id: string) {
  const { error } = await sb().from('eval_photos').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
