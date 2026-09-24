'use client'

import { useState } from 'react'
import type { GuildRole } from '@/lib/automation/discordRoles'
import { createRule, setRuleEnabled, updateRule, type RuleRow } from './actions'

interface Props {
  rules: RuleRow[]
  roles: GuildRole[]
  rolesError: string
  tracks: string[]
}

export default function AutomationsClient({ rules: initial, roles, rolesError, tracks }: Props) {
  const [rules, setRules] = useState(initial)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const [newName, setNewName] = useState('')
  const [newTrack, setNewTrack] = useState('')
  const [newRole, setNewRole] = useState('')
  const [creating, setCreating] = useState(false)

  const assignable = roles.filter((r) => r.assignable)
  const roleName = (id: string | null) => roles.find((r) => r.id === id)?.name ?? 'Role not found in Discord'

  async function handleRoleChange(rule: RuleRow, roleId: string) {
    setBusyId(rule.id)
    setMessage(null)
    const { error } = await updateRule(rule.id, { name: rule.name, track: rule.track, roleId })
    if (error) setMessage({ kind: 'error', text: error })
    else {
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, roleId } : r)))
      setMessage({ kind: 'ok', text: 'Saved. It applies the next time a person is checked.' })
    }
    setBusyId(null)
  }

  async function handleToggle(rule: RuleRow) {
    setBusyId(rule.id)
    setMessage(null)
    const { error } = await setRuleEnabled(rule.id, !rule.enabled)
    if (error) setMessage({ kind: 'error', text: error })
    else setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !rule.enabled } : r)))
    setBusyId(null)
  }

  async function handleCreate() {
    setCreating(true)
    setMessage(null)
    const { error } = await createRule({ name: newName, track: newTrack || null, roleId: newRole })
    if (error) {
      setMessage({ kind: 'error', text: error })
    } else {
      setNewName('')
      setNewTrack('')
      setNewRole('')
      setMessage({ kind: 'ok', text: 'Rule added. Reload to see it in the list.' })
    }
    setCreating(false)
  }

  return (
    <div>
      {rolesError && <div className="invite-error">{rolesError} Role names cannot be shown until this is fixed.</div>}
      {message && <div className={message.kind === 'ok' ? 'invite-success' : 'invite-error'}>{message.text}</div>}

      <div className="team-access-layout">
        <div className="team-access-panel">
          <div className="team-access-panel-title">Who gets which Discord role</div>
          {rules.length === 0 ? (
            <div className="team-empty">No rules yet.</div>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="team-user-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="team-user-email">{rule.name}</div>
                  <div className="team-user-date">{rule.track ? `People on the ${rule.track} track` : 'Everyone with dashboard access'}</div>
                </div>
                <select
                  className="team-role-select"
                  value={rule.roleId ?? ''}
                  disabled={busyId === rule.id || assignable.length === 0}
                  onChange={(e) => handleRoleChange(rule, e.target.value)}
                  aria-label={`Discord role for ${rule.name}`}
                >
                  {rule.roleId && !assignable.some((r) => r.id === rule.roleId) && (
                    <option value={rule.roleId}>{roleName(rule.roleId)}</option>
                  )}
                  {assignable.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <button className="team-remove-btn" disabled={busyId === rule.id} onClick={() => handleToggle(rule)}>
                  {rule.enabled ? 'Turn off' : 'Turn on'}
                </button>
              </div>
            ))
          )}
          <div className="team-user-date" style={{ marginTop: 12 }}>
            Archiving someone removes every role listed here. Turning a rule off stops new grants but still removes the role on archive.
          </div>
        </div>

        <div className="team-access-panel">
          <div className="team-access-panel-title">Add a rule</div>
          <div className="invite-panel">
            <div>
              <div className="invite-label">Name</div>
              <input id="rule-name" className="invite-input" value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Track: Operations to Operations" />
            </div>
            <div>
              <div className="invite-label">Applies to</div>
              <select id="rule-track" className="invite-select" value={newTrack} onChange={(e) => setNewTrack(e.target.value)}>
                <option value="">Everyone with dashboard access</option>
                {tracks.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="invite-label">Discord role</div>
              <select id="rule-role" className="invite-select" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                <option value="">Choose a role</option>
                {assignable.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <button className="invite-btn" disabled={creating || !newName.trim() || !newRole} onClick={handleCreate}>
              {creating ? 'Adding...' : 'Add rule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
