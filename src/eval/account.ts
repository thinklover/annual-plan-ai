// 登入後開啟帳號資料；資料庫還是空的時候，把舊版留在這台電腦瀏覽器裡的資料搬上去。
import { loadDocs, saveDocs, type DocChange } from './db'
import { putPhoto, type Photo } from './photos'
import { normalize, SECTIONS } from './store'
import type { EvalData } from './types'

export interface Opened {
  data: EvalData
  versions: Record<string, number>
}

const LEGACY_KEY = 'home-eval:data'
const LEGACY_DB = 'home-eval-photos'

function legacyData(): EvalData | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    return raw ? normalize(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

/** 舊版存在 IndexedDB 的照片；沒有就回傳空陣列 */
function legacyPhotos(): Promise<Photo[]> {
  return new Promise((resolve) => {
    const req = indexedDB.open(LEGACY_DB)
    req.onerror = () => resolve([])
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('photos')) {
        db.close()
        return resolve([])
      }
      const all = db.transaction('photos', 'readonly').objectStore('photos').getAll()
      all.onsuccess = () => {
        db.close()
        resolve(all.result as Photo[])
      }
      all.onerror = () => {
        db.close()
        resolve([])
      }
    }
  })
}

const hasContent = (d: EvalData) =>
  !!d.org.name || d.employees.length + d.meetings.length + d.supervisions.length + d.incidents.length + d.caseMeetings.length > 0 ||
  Object.keys(d.plans).length + Object.keys(d.capacity).length > 0

/** 搬移成功回傳 true；沒有舊資料或使用者不搬回傳 false */
async function migrateLegacy(): Promise<boolean> {
  const old = legacyData()
  if (!old || !hasContent(old)) return false
  const ok = window.confirm(
    `這台電腦的瀏覽器裡有舊版的資料（員工 ${old.employees.length} 人、會議與紀錄 ${old.meetings.length + old.supervisions.length + old.incidents.length + old.caseMeetings.length} 筆）。\n\n` +
    '要搬到這個帳號的資料庫嗎？搬完後會從這台電腦的瀏覽器移除。\n（按「取消」則從空白開始，舊資料會留在瀏覽器裡）',
  )
  if (!ok) return false
  const used = new Set([...old.meetings, ...old.supervisions, ...old.caseMeetings].flatMap((x) => x.photos))
  for (const p of await legacyPhotos()) if (used.has(p.id)) await putPhoto(p)
  const changes: Record<string, DocChange> = {}
  for (const k of SECTIONS) changes[k] = { version: 0, data: old[k] }
  await saveDocs(changes)
  // 已經寫進資料庫，才移除瀏覽器裡的舊資料
  localStorage.removeItem(LEGACY_KEY)
  indexedDB.deleteDatabase(LEGACY_DB)
  return true
}

const opening = new Map<string, Promise<Opened>>()

/** 讀取帳號的全部資料。同一個帳號重複呼叫共用同一次讀取（避免重複詢問搬移） */
export function openAccount(uid: string): Promise<Opened> {
  let p = opening.get(uid)
  if (!p) {
    p = (async () => {
      let res = await loadDocs()
      if (!Object.keys(res.docs).length && (await migrateLegacy())) res = await loadDocs()
      return { data: normalize(res.docs as Partial<EvalData>), versions: res.versions }
    })()
    opening.set(uid, p)
    p.catch(() => opening.delete(uid))
  }
  return p
}

export const forgetAccount = (uid: string) => opening.delete(uid)
export const forgetAccounts = () => opening.clear()
