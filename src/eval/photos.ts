// 照片儲存層：目前存在瀏覽器 IndexedDB。日後改放檔案伺服器時只需替換本檔。
export interface Photo {
  id: string
  dataUrl: string
  w: number
  h: number
}

const DB = 'home-eval-photos'
const STORE = 'photos'
export const MAX_PHOTOS = 6
const MAX_EDGE = 1280

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const getPhoto = (id: string) => tx<Photo | undefined>('readonly', (s) => s.get(id))
export const putPhoto = (p: Photo) => tx('readwrite', (s) => s.put(p))
export const deletePhoto = (id: string) => tx('readwrite', (s) => s.delete(id))
export const allPhotos = () => tx<Photo[]>('readonly', (s) => s.getAll())
export const clearPhotos = () => tx('readwrite', (s) => s.clear())

export async function getPhotos(ids: string[]): Promise<Photo[]> {
  const list = await Promise.all(ids.map(getPhoto))
  return list.filter((p): p is Photo => !!p)
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
