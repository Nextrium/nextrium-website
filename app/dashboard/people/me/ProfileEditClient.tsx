'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveProfile, unlinkDiscord } from '../actions'

const DISCORD_NOTICES: Record<string, { text: string; ok: boolean }> = {
  linked:      { text: 'Discord connected.', ok: true },
  denied:      { text: 'You cancelled the Discord connection.', ok: false },
  taken:       { text: 'That Discord account is already connected to another team member.', ok: false },
  unavailable: { text: 'Discord connection is not set up yet. Ask an administrator.', ok: false },
  error:       { text: 'We could not complete the Discord connection. Please try again.', ok: false },
}

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
  discordUsername,
  discordAvailable,
  discordNotice,
}: {
  isFirstTime: boolean
  initialBio: string
  initialHandles: Record<string, string>
  discordUsername: string | null
  discordAvailable: boolean
  discordNotice: string | null
}) {
  const router = useRouter()
  const [disconnecting, setDisconnecting] = useState(false)
  const [discordError, setDiscordError] = useState('')
  const notice = discordNotice ? DISCORD_NOTICES[discordNotice] : null

  async function handleDisconnect() {
    setDisconnecting(true)
    setDiscordError('')
    const res = await unlinkDiscord()
    setDisconnecting(false)
    if (res.error) { setDiscordError(res.error); return }
    router.replace('/dashboard/people/me')
    router.refresh()
  }
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
        .profile-form-ok { padding: 10px 14px; font-size: 12px; background: rgba(34,193,122,0.08); border: 1px solid rgba(34,193,122,0.3); color: var(--success); margin-bottom: 16px; }
        .profile-discord-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
        .profile-discord-name { font-size: 13px; color: var(--off-white); line-height: 1.5; max-width: 60ch; }
        .profile-discord-btn { padding: 9px 16px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(219,103,39,0.4); background: none; color: var(--orange); text-decoration: none; white-space: nowrap; }
        .profile-discord-btn:disabled { opacity: 0.6; cursor: not-allowed; }
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

          <div className="profile-form-section-title">Discord</div>
          {notice && (
            <div className={notice.ok ? 'profile-form-ok' : 'profile-form-error'}>{notice.text}</div>
          )}
          {discordError && <div className="profile-form-error">{discordError}</div>}
          {discordUsername ? (
            <div className="profile-discord-row">
              <span className="profile-discord-name">Connected as <strong>{discordUsername}</strong></span>
              <button type="button" className="profile-discord-btn" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <div className="profile-discord-row">
              <span className="profile-discord-name">
                Join and verify in the Nextrium Discord server first, then connect your account here so you can be added to your track's private channel.
              </span>
              {discordAvailable ? (
                <a className="profile-discord-btn" href="/api/discord/link">Connect Discord</a>
              ) : (
                <span className="profile-discord-name">Not available yet.</span>
              )}
            </div>
          )}

          <button type="submit" className="profile-form-submit" disabled={saving}>
            {saving ? 'Saving...' : isFirstTime ? 'Save & continue' : 'Save changes'}
          </button>
        </form>
      </div>
    </>
  )
}
