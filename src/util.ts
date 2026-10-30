/* eslint-disable @typescript-eslint/no-explicit-any */
export function getPath(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

export function setPath(obj: any, path: string, value: any) {
  const keys = path.split('.')
  const last = keys.pop()!
  const target = keys.reduce((o, k) => o[k], obj)
  target[last] = value
}

export function isBlank(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.every(isBlank)
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>).every(([k, x]) => k === 'id' || k === 'enabled' || isBlank(x))
  }
  return false
}

export const num = (s: string) => {
  const n = Number(String(s).replace(/[,，\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function download(filename: string, blob: Blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift()!)
  })
  await Promise.all(workers)
}
