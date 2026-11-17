// 入口：先登入，讀完帳號資料才顯示系統。
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { forgetAccount, forgetAccounts, openAccount, type Opened } from './account'
import { dbConfigured, signIn, signOut, watchAccount, type Account } from './db'
import { StoreProvider } from './store'

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="gate">
      <div className="gate-card">
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card title="居家評鑑資料系統">
      <p>請登入後使用。</p>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
        <label>
          帳號（Email）
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          密碼
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="err">{error}</div>}
        <button type="submit" className="btn primary" disabled={busy}>{busy ? '登入中…' : '登入'}</button>
      </form>
    </Card>
  )
}

type Load = { uid: string; opened?: Opened; error?: string }

export function Gate({ children }: { children: ReactNode }) {
  // undefined＝還在確認登入狀態
  const [account, setAccount] = useState<Account | null | undefined>(undefined)
  const [load, setLoad] = useState<Load | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!dbConfigured) return
    // 同一個帳號的重複通知（換新登入憑證等）不重新載入
    return watchAccount((a) => {
      if (!a) {
        // 登出：下次登入要重新讀取
        forgetAccounts()
        setLoad(null)
      }
      setAccount((prev) => (prev && a && prev.id === a.id ? prev : a))
    })
  }, [])

  const uid = account?.id
  useEffect(() => {
    if (!uid) return
    let alive = true
    openAccount(uid).then(
      (opened) => alive && setLoad({ uid, opened }),
      (e: Error) => alive && setLoad({ uid, error: e.message }),
    )
    return () => {
      alive = false
    }
  }, [uid, attempt])

  if (!dbConfigured) {
    return <Card title="尚未設定資料庫金鑰"><p>請在 src/eval/db.ts 填入 Supabase 的 publishable 金鑰。</p></Card>
  }
  if (account === undefined) return <Card title="居家評鑑資料系統"><p>載入中…</p></Card>
  if (!account) return <Login />

  const mine = load?.uid === account.id ? load : null
  if (mine?.error) {
    return (
      <Card title="讀取資料失敗">
        <div className="err">{mine.error}</div>
        <button type="button" className="btn primary" onClick={() => { forgetAccount(account.id); setLoad(null); setAttempt((n) => n + 1) }}>再試一次</button>
        <button type="button" className="btn ghost" onClick={() => void signOut()}>登出</button>
      </Card>
    )
  }
  if (!mine?.opened) return <Card title="居家評鑑資料系統"><p>讀取資料中…</p></Card>

  return (
    <StoreProvider key={account.id} initial={mine.opened.data} versions={mine.opened.versions} email={account.email}>
      {children}
    </StoreProvider>
  )
}
