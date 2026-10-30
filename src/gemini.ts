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
