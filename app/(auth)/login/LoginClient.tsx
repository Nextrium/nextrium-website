'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logActivityAction } from '@/app/actions/activityLog'
import NTMark from '@/components/shared/NTMark'

export default function LoginClient({ message, error: initialError }: { message?: string; error?: string }) {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(initialError ?? null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message || 'Invalid email or password.')
      return
    }
    logActivityAction({ action: 'sign_in' }).catch(() => {})
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <>
      <style>{`
        .login-page {
          min-height: 100vh; background: var(--navy-deep);
          display: flex; align-items: center; justify-content: center; padding: 24px;
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 72px 72px;
        }
        .login-card {
          width: 100%; max-width: 400px; background: var(--navy);
          border: 1px solid rgba(255,255,255,0.08); position: relative; overflow: hidden;
        }
        .login-card-corner-tl {
          position: absolute; top: -1px; left: -1px; width: 16px; height: 16px;
          border-top: 2px solid var(--orange); border-left: 2px solid var(--orange);
        }
        .login-card-corner-br {
          position: absolute; bottom: -1px; right: -1px; width: 16px; height: 16px;
          border-bottom: 2px solid var(--orange); border-right: 2px solid var(--orange);
        }
        .login-header {
          padding: 32px 32px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; gap: 12px;
        }
        .login-title {
          font-family: var(--font-exo2, 'Exo 2', sans-serif);
          font-weight: 800; font-size: 20px; color: var(--white); letter-spacing: -0.3px;
        }
        .login-subtitle {
          font-family: var(--font-mono, 'Space Mono', monospace);
          font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--grey-mid); margin-top: 4px;
        }
        .login-body { padding: 32px; }
        .login-form { display: flex; flex-direction: column; gap: 16px; }
        .login-group { display: flex; flex-direction: column; gap: 8px; }
        .login-label {
          font-family: var(--font-mono, 'Space Mono', monospace);
          font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid);
        }
        .login-input {
          background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08);
          color: var(--white); font-family: var(--font-dm, 'DM Sans', sans-serif);
          font-size: 14px; padding: 12px 16px; outline: none; width: 100%;
          transition: border-color 0.15s ease;
        }
        .login-input:focus { border-color: var(--orange); }
        .login-input::placeholder { color: var(--grey-dark); }
        .login-error {
          font-size: 12px; color: var(--error);
          background: rgba(232,69,69,0.08); border: 1px solid rgba(232,69,69,0.2);
          padding: 10px 14px;
        }
        .login-submit {
          background: var(--orange); color: var(--white); border: 1px solid var(--orange);
          padding: 14px 24px; font-family: var(--font-dm, 'DM Sans', sans-serif);
          font-size: 14px; cursor: pointer; width: 100%;
          display: flex; align-items: center; justify-content: space-between;
          transition: background 0.15s ease;
        }
        .login-submit:hover:not(:disabled) { background: var(--orange-f, #C4521A); }
        .login-submit:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div className="login-page">
        <div className="login-card">
          <div className="login-card-corner-tl" />
          <div className="login-card-corner-br" />
          <div className="login-header">
            <NTMark size={36} />
            <div>
              <div className="login-title">Dashboard</div>
              <div className="login-subtitle">NexTrium Admin</div>
            </div>
          </div>
          <div className="login-body">
            <form className="login-form" onSubmit={handleSubmit} noValidate>
              {message === 'password_set' && (
                <div style={{ fontSize: '12px', color: 'var(--success)', background: 'rgba(34,193,122,0.08)', border: '1px solid rgba(34,193,122,0.2)', padding: '10px 14px' }}>
                  Password set successfully. Sign in to continue.
                </div>
              )}
              {error && <div className="login-error">{error}</div>}
              <div className="login-group">
                <label className="login-label" htmlFor="email">Email address</label>
                <input className="login-input" id="email" type="email" placeholder="your@email.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="login-group">
                <label className="login-label" htmlFor="password">Password</label>
                <input className="login-input" id="password" type="password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              <button type="submit" className="login-submit" disabled={loading}>
                <span>{loading ? 'Signing in...' : 'Sign in'}</span>
                <span>{loading ? '...' : '→'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
