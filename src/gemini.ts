import type { Settings } from './types'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

async function readError(res: Response) {
  try {
    const j = await res.json()
    return j?.error?.message || res.statusText
  } catch {
    return res.statusText
  }
}

export async function generate(settings: Settings, system: string, prompt: string, json = true): Promise<string> {
  if (!settings.apiKey) throw new Error('尚未設定 Gemini API Key，請先到「設定」輸入。')
  const res = await fetch(`${BASE}/models/${encodeURIComponent(settings.model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, ...(json ? { responseMimeType: 'application/json' } : {}) },
    }),
  })
  if (!res.ok) throw new Error(`Gemini 呼叫失敗（${res.status}）：${await readError(res)}`)
  const data = await res.json()
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? '')
    .join('')
  if (!text) throw new Error(`Gemini 沒有回傳內容（${data?.candidates?.[0]?.finishReason ?? '未知原因'}）`)
  return text
}

/** 可直接放進請求的檔案大小上限；超過就先上傳到 Files API */
const INLINE_LIMIT = 12 * 1024 * 1024

async function toBase64(file: Blob): Promise<string> {
  const url = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('無法讀取檔案'))
    r.readAsDataURL(file)
  })
  return url.slice(url.indexOf(',') + 1)
}

const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mp3', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', amr: 'audio/amr',
  mp4: 'video/mp4', webm: 'audio/webm', pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
}
/** 瀏覽器回報的類型有時是空的或 Gemini 不認得（例如 audio/x-m4a），以副檔名為準 */
export const mimeOf = (file: File) => MIME_BY_EXT[file.name.split('.').pop()?.toLowerCase() ?? ''] || file.type || 'application/octet-stream'

/** 大檔案走 Files API（續傳協定），回傳可放進 fileData 的 uri */
async function uploadFile(apiKey: string, file: File, mime: string): Promise<string> {
  const start = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(file.size),
      'X-Goog-Upload-Header-Content-Type': mime,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'upload' } }),
  })
  const url = start.headers.get('x-goog-upload-url')
  if (!start.ok || !url) throw new Error(`檔案上傳失敗（${start.status}）：${await readError(start)}`)
  const up = await fetch(url, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: file,
  })
  if (!up.ok) throw new Error(`檔案上傳失敗（${up.status}）：${await readError(up)}`)
  let info = (await up.json()).file as { name: string; uri: string; state?: string }
  // 錄音檔要等 Gemini 處理完才能使用
  for (let i = 0; i < 60 && info.state === 'PROCESSING'; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const res = await fetch(`${BASE}/${info.name}`, { headers: { 'x-goog-api-key': apiKey } })
    if (!res.ok) throw new Error(`檔案處理失敗（${res.status}）：${await readError(res)}`)
    info = await res.json()
  }
  if (info.state && info.state !== 'ACTIVE') throw new Error('檔案處理失敗，請確認檔案格式後再試一次。')
  return info.uri
}

/** 把錄音檔、PDF 或圖片連同指示一起交給 Gemini，回傳 JSON 文字 */
export async function generateFromFile(settings: Settings, system: string, prompt: string, file: File): Promise<string> {
  if (!settings.apiKey) throw new Error('尚未設定 Gemini API Key，請先到「設定」輸入。')
  const mime = mimeOf(file)
  const part = file.size <= INLINE_LIMIT
    ? { inlineData: { mimeType: mime, data: await toBase64(file) } }
    : { fileData: { mimeType: mime, fileUri: await uploadFile(settings.apiKey, file, mime) } }
  const res = await fetch(`${BASE}/models/${encodeURIComponent(settings.model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [part, { text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  })
  if (!res.ok) throw new Error(`Gemini 呼叫失敗（${res.status}）：${await readError(res)}`)
  const data = await res.json()
  const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('')
  if (!text) throw new Error(`Gemini 沒有回傳內容（${data?.candidates?.[0]?.finishReason ?? '未知原因'}）`)
  return text
}

export function parseJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(cleaned) as T
  } catch {
    // 模型偶爾輸出不合法的跳脫字元（例如 \、），把落單的反斜線補成兩個再試一次
    return JSON.parse(cleaned.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')) as T
  }
}

export async function listModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } })
  if (!res.ok) throw new Error(`無法取得模型清單（${res.status}）：${await readError(res)}`)
  const data = await res.json()
  return (data.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: { name: string }) => m.name.replace(/^models\//, ''))
}
