// 照片儲存層：縮圖後存到雲端資料庫（見 db.ts）。看過的照片留在記憶體，避免重複下載。
import { insertPhoto, removePhoto, selectPhotos } from './db'

export interface Photo {
  id: string
  dataUrl: string
  w: number
  h: number
}

export const MAX_PHOTOS = 6
const MAX_EDGE = 1280

const cache = new Map<string, Photo>()

export async function putPhoto(p: Photo) {
  await insertPhoto(p)
  cache.set(p.id, p)
}

export async function deletePhoto(id: string) {
  cache.delete(id)
  await removePhoto(id)
}

/** 依傳入的順序回傳；資料庫裡找不到的略過 */
export async function getPhotos(ids: string[]): Promise<Photo[]> {
  const missing = ids.filter((id) => !cache.has(id))
  for (const p of await selectPhotos(missing)) cache.set(p.id, p)
  return ids.map((id) => cache.get(id)).filter((p): p is Photo => !!p)
}

/** 讀入圖片，縮到長邊 1280px 的 JPEG 後存起來 */
export async function addPhoto(file: File): Promise<Photo> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error(`無法讀取圖片：${file.name}`))
      i.src = url
    })
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    const photo = { id: crypto.randomUUID(), dataUrl: canvas.toDataURL('image/jpeg', 0.85), w, h }
    await putPhoto(photo)
    return photo
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.split(',')[1] ?? '')
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
