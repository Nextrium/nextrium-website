'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveProfile } from '../actions'

const HANDLE_FIELDS = [
  { key: 'twitter',  label: 'Twitter / X', placeholder: '@handle' },
  { key: 'linkedin', label: 'LinkedIn',    placeholder: 'linkedin.com/in/...' },
  { key: 'github',   label: 'GitHub',      placeholder: '@handle' },
  { key: 'website',  label: 'Website',     placeholder: 'https://...' },
]

export default function ProfileEditClient({
  isFirstTime,
  initialBio,
  initialHandles,
}: {
  isFirstTime: boolean
  initialBio: string
  initialHandles: Record<string, string>
}) {
  const router = useRouter()
  const [bio, setBio] = useState(initialBio)
  const [handles, setHandles] = useState<Record<string, string>>(initialHandles)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await saveProfile({ bio, socialHandles: handles })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    router.push('/dashboard/people')
    router.refresh()
  }

  return (
    <>
      <style>{`
        .profile-form-wrap { max-width: 560px; }
        .profile-form-card { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 28px; }
        .profile-form-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); margin-bottom: 8px; display: block; }
        .profile-form-input, .profile-form-textarea { background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 13px; padding: 10px 12px; outline: none; width: 100%; margin-bottom: 18px; }
        .profile-form-textarea { min-height: 90px; resize: vertical; }
        .profile-form-section-title { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--white); margin: 22px 0 14px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.06); }
        .profile-form-submit { padding: 12px 24px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; border: 1px solid var(--orange); background: var(--orange); color: var(--white); }
        .profile-form-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .profile-form-error { padding: 10px 14px; font-size: 12px; background: rgba(232,69,69,0.08); border: 1px solid rgba(232,69,69,0.3); color: var(--error); margin-bottom: 16px; }
      `}</style>

      <div className="profile-form-wrap">
        <form className="profile-form-card" onSubmit={handleSubmit}>
          {error && <div className="profile-form-error">{error}</div>}

          <label className="profile-form-label">Bio</label>
          <textarea
            className="profile-form-textarea"
            placeholder="A short intro — what you work on, what you're into."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />

          <div className="profile-form-section-title">Social handles (optional)</div>
          {HANDLE_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="profile-form-label">{f.label}</label>
              <input
                className="profile-form-input"
                type="text"
                placeholder={f.placeholder}
                value={handles[f.key] ?? ''}
                onChange={(e) => setHandles((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}

          <button type="submit" className="profile-form-submit" disabled={saving}>
            {saving ? 'Saving...' : isFirstTime ? 'Save & continue' : 'Save changes'}
          </button>
        </form>
      </div>
    </>
  )
}
