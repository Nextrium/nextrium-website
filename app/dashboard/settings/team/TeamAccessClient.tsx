'use client'

import { useState } from 'react'
import { inviteUser, updateRole, removeUser, archiveUser, unarchiveUser, setTeamMember, setStaffTrack, syncPersonAccess, sendPasswordSetupLink } from './actions'

interface DashboardUserRow {
  user_id: string
  role: string
  created_at: string
  email: string
  archived: boolean
  archived_at: string | null
  is_team_member: boolean
  track?: string | null
  discord_linked?: boolean
  application_track?: string | null
  has_application?: boolean
}

// "Member" is contribution-only access (Team page and their own profile). To
// let an admin or moderator log contributions too, keep their role and tick
// "Team member" on their row instead.
const ROLE_OPTIONS = [
  { value: 'admin',     label: 'Admin' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'content',   label: 'Content' },
  { value: 'community', label: 'Community' },
  { value: 'member',    label: 'Member (contributions only)' },
]

export default function TeamAccessClient({ users: initial, tracks }: { users: DashboardUserRow[]; tracks: string[] }) {
  const [users,          setUsers]          = useState(initial)
  const [inviteEmail,    setInviteEmail]    = useState('')
  const [inviteRole,     setInviteRole]     = useState('content')
  const [inviting,       setInviting]       = useState(false)
  const [inviteError,    setInviteError]    = useState('')
  const [inviteSuccess,  setInviteSuccess]  = useState('')
  const [updatingId,     setUpdatingId]     = useState<string | null>(null)
  const [removingId,     setRemovingId]     = useState<string | null>(null)
  const [confirmRemove,  setConfirmRemove]  = useState<string | null>(null)
  const [archivingId,    setArchivingId]    = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null)
  const [archiveError,   setArchiveError]   = useState<string | null>(null)
  const [rowNote,        setRowNote]        = useState<{ id: string; kind: 'ok' | 'error'; text: string } | null>(null)

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError('')
    setInviteSuccess('')

    const { error, notice, added, teamMemberSet } = await inviteUser(inviteEmail.trim(), inviteRole)
    if (error) {
      setInviteError(error)
    } else {
      if (added) setUsers((prev) => [...prev, added])
      if (teamMemberSet) setUsers((prev) => prev.map((u) => u.user_id === teamMemberSet ? { ...u, is_team_member: true } : u))
      setInviteSuccess(notice ?? `Invite sent to ${inviteEmail.trim()}.`)
      setInviteEmail('')
      setInviteRole('content')
    }
    setInviting(false)
  }

  async function handleRoleChange(userId: string, role: string) {
    setUpdatingId(userId)
    const { error } = await updateRole(userId, role)
    if (!error) {
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, role, is_team_member: u.is_team_member || role === 'member' } : u))
    }
    setUpdatingId(null)
  }

  async function handleTeamMemberToggle(userId: string, isMember: boolean) {
    setUpdatingId(userId)
    setInviteError('')
    const { error } = await setTeamMember(userId, isMember)
    if (error) {
      setInviteError(error)
    } else {
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, is_team_member: isMember } : u))
    }
    setUpdatingId(null)
  }

  async function handleTrackChange(userId: string, value: string) {
    setUpdatingId(userId)
    setRowNote(null)
    const { error, notice } = await setStaffTrack(userId, value || null)
    if (error) {
      setRowNote({ id: userId, kind: 'error', text: error })
    } else {
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, track: value || null } : u))
      setRowNote({ id: userId, kind: 'ok', text: notice ?? 'Saved.' })
    }
    setUpdatingId(null)
  }

  async function handleSync(userId: string) {
    setUpdatingId(userId)
    setRowNote(null)
    const { error, notice } = await syncPersonAccess(userId)
    setRowNote({ id: userId, kind: error ? 'error' : 'ok', text: error ?? notice ?? 'Done.' })
    setUpdatingId(null)
  }

  async function handlePasswordLink(userId: string) {
    setUpdatingId(userId)
    setRowNote(null)
    const { error, notice } = await sendPasswordSetupLink(userId)
    setRowNote({ id: userId, kind: error ? 'error' : 'ok', text: error ?? notice ?? 'Sent.' })
    setUpdatingId(null)
  }

  async function handleRemove(userId: string) {
    if (confirmRemove !== userId) {
      setConfirmRemove(userId)
      return
    }
    setRemovingId(userId)
    const { error } = await removeUser(userId)
    if (!error) {
      setUsers((prev) => prev.filter((u) => u.user_id !== userId))
      setConfirmRemove(null)
    }
    setRemovingId(null)
  }

  async function handleArchive(userId: string) {
    if (confirmArchive !== userId) {
      setConfirmArchive(userId)
      setArchiveError(null)
      return
    }
    setArchivingId(userId)
    setArchiveError(null)
    const { error } = await archiveUser(userId)
    if (!error) {
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, archived: true, archived_at: new Date().toISOString() } : u))
      setConfirmArchive(null)
    } else {
      setArchiveError(error)
    }
    setArchivingId(null)
  }

  async function handleUnarchive(userId: string) {
    setArchivingId(userId)
    setArchiveError(null)
    const { error } = await unarchiveUser(userId)
    if (!error) {
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, archived: false, archived_at: null } : u))
    } else {
      setArchiveError(error)
    }
    setArchivingId(null)
  }

  return (
    <>
      <style>{`
        .team-access-layout { display: grid; grid-template-columns: 1fr 320px; gap: 24px; align-items: start; }
        .team-access-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); }
        .team-access-panel-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .team-user-row { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .team-user-row:last-child { border-bottom: none; }
        .team-user-email { font-size: 13px; color: var(--white); }
        .team-user-date { font-size: 11px; color: var(--grey-dark); font-family: var(--font-mono); margin-top: 3px; }
        .team-role-badge { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; display: inline-block; }
        .team-role-select { background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 12px; padding: 6px 10px; outline: none; cursor: pointer; }
        .team-remove-btn { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; padding: 6px 10px; background: none; border: 1px solid rgba(232,69,69,0.3); color: var(--error); cursor: pointer; transition: all 0.15s ease; white-space: nowrap; }
        .team-remove-btn.confirm { background: rgba(232,69,69,0.1); border-color: var(--error); }
        .team-remove-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .team-archived-badge { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; padding: 6px 10px; background: rgba(212,168,67,0.08); border: 1px solid rgba(212,168,67,0.3); color: var(--warning); white-space: nowrap; }
        .invite-panel { display: flex; flex-direction: column; gap: 14px; padding: 20px; }
        .invite-input { background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 13px; padding: 10px 12px; outline: none; width: 100%; }
        .invite-input:focus { border-color: var(--orange); }
        .invite-select { background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 13px; padding: 10px 12px; outline: none; width: 100%; cursor: pointer; }
        .invite-btn { padding: 10px 16px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; border: 1px solid var(--orange); background: var(--orange); color: var(--white); transition: all 0.15s ease; }
        .invite-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .invite-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); }
        .invite-success { padding: 10px 14px; font-size: 12px; background: rgba(34,193,122,0.08); border: 1px solid rgba(34,193,122,0.2); color: var(--success); }
        .invite-error { padding: 10px 14px; font-size: 12px; background: rgba(232,69,69,0.08); border: 1px solid rgba(232,69,69,0.3); color: var(--error); }
        .team-empty { padding: 48px 20px; text-align: center; font-size: 13px; color: var(--grey-dark); }
        @media (max-width: 900px) { .team-access-layout { grid-template-columns: 1fr; } }
      `}</style>

      <div className="team-access-layout">
        <div className="team-access-panel">
          <div className="team-access-panel-title">Current team members</div>
          {users.length === 0 ? (
            <div className="team-empty">No dashboard users yet.</div>
          ) : (
            users.map((user) => {
              return (
                <div key={user.user_id} className="team-user-row">
                  <div>
                    <div className="team-user-email">{user.email}</div>
                    <div className="team-user-date">
                      Added {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    {!user.archived && (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11px', color: 'var(--off-white)', cursor: user.role === 'member' ? 'default' : 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={user.is_team_member}
                          disabled={updatingId === user.user_id || user.role === 'member'}
                          onChange={(e) => handleTeamMemberToggle(user.user_id, e.target.checked)}
                        />
                        Team member (can log contributions)
                      </label>
                    )}
                    {!user.archived && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        <select
                          className="team-role-select"
                          value={user.track ?? ''}
                          disabled={updatingId === user.user_id}
                          onChange={(e) => handleTrackChange(user.user_id, e.target.value)}
                          aria-label={`Track for ${user.email}`}
                        >
                          <option value="">{user.application_track ? `From application: ${user.application_track}` : 'No track'}</option>
                          {tracks.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="team-remove-btn"
                          style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'var(--off-white)' }}
                          disabled={updatingId === user.user_id}
                          onClick={() => handleSync(user.user_id)}
                          title={user.discord_linked ? 'Give this person their Discord roles now' : 'They have not linked Discord yet'}
                        >
                          Sync Discord
                        </button>
                        <button
                          type="button"
                          className="team-remove-btn"
                          style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'var(--off-white)' }}
                          disabled={updatingId === user.user_id}
                          onClick={() => handlePasswordLink(user.user_id)}
                        >
                          Send password link
                        </button>
                      </div>
                    )}
                    {!user.archived && !user.track && !user.application_track && user.has_application && (
                      <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--warning)' }}>
                        This applicant was never screened, so no track role will be given. Pick a track above.
                      </div>
                    )}
                    {rowNote && rowNote.id === user.user_id && (
                      <div style={{ fontSize: '11px', marginTop: '4px', color: rowNote.kind === 'ok' ? 'var(--success)' : 'var(--error)' }}>{rowNote.text}</div>
                    )}
                    {archiveError && (archivingId === user.user_id || confirmArchive === user.user_id) && (
                      <div style={{ fontSize: '11px', color: 'var(--error)', marginTop: '4px' }}>{archiveError}</div>
                    )}
                  </div>
                  {user.archived ? (
                    <div className="team-archived-badge" title={user.archived_at ? `Archived ${new Date(user.archived_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined}>
                      Archived
                    </div>
                  ) : (
                    <select
                      className="team-role-select"
                      value={user.role}
                      disabled={updatingId === user.user_id}
                      onChange={(e) => handleRoleChange(user.user_id, e.target.value)}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  )}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {user.archived ? (
                      <button
                        type="button"
                        className="team-remove-btn"
                        disabled={archivingId === user.user_id}
                        onClick={() => handleUnarchive(user.user_id)}
                      >
                        {archivingId === user.user_id ? 'Unarchiving...' : 'Unarchive'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`team-remove-btn ${confirmArchive === user.user_id ? 'confirm' : ''}`}
                        disabled={archivingId === user.user_id}
                        onClick={() => handleArchive(user.user_id)}
                      >
                        {archivingId === user.user_id
                          ? 'Archiving...'
                          : confirmArchive === user.user_id
                          ? 'Confirm'
                          : 'Archive'}
                      </button>
                    )}
                    <button
                      type="button"
                      className={`team-remove-btn ${confirmRemove === user.user_id ? 'confirm' : ''}`}
                      disabled={removingId === user.user_id}
                      onClick={() => handleRemove(user.user_id)}
                    >
                      {removingId === user.user_id
                        ? 'Removing...'
                        : confirmRemove === user.user_id
                        ? 'Confirm'
                        : 'Remove'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="team-access-panel">
          <div className="team-access-panel-title">Invite a team member</div>
          <div className="invite-panel">
            {inviteSuccess && <div className="invite-success">{inviteSuccess}</div>}
            {inviteError && <div className="invite-error">{inviteError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="invite-label">Email address</div>
              <input
                className="invite-input"
                type="email"
                placeholder="team@nextrium.org"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="invite-label">Role</div>
              <select
                className="invite-select"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="invite-btn"
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
            >
              {inviting ? 'Sending invite...' : 'Send invite'}
            </button>
            <div style={{ fontSize: '11px', color: 'var(--grey-dark)', lineHeight: '1.6' }}>
              The invited person will receive an email to set their password and access the dashboard. Their role can be changed at any time.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}