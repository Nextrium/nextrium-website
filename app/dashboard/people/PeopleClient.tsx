'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export interface PersonCard {
  userId:          string
  email:           string
  role:            string
  bio:             string | null
  socialHandles:   Record<string, string>
  discordUsername: string | null
  discordLinked:   boolean
  trackName:       string | null
  isTeamMember:    boolean
}

const ROLE_LABELS: Record<string, string> = {
  admin:     'Admin',
  content:   'Content',
  community: 'Community',
  moderator: 'Moderator',
  member:    'Team Member',
}

function PersonCardItem({ person }: { person: PersonCard }) {
  const displayName = person.email.split('@')[0]
  const handleCount = Object.values(person.socialHandles).filter(Boolean).length

  return (
    <Link href={`/dashboard/people/${person.userId}`} className="person-card">
      <div className="person-card-avatar">{displayName.slice(0, 2).toUpperCase()}</div>
      <div className="person-card-body">
        <div className="person-card-name">{displayName}</div>
        <div className="person-card-email">{person.email}</div>
        <div className="person-card-meta">
          <span className="person-card-role">{ROLE_LABELS[person.role] ?? person.role}</span>
          {person.trackName && <span className="person-card-track">{person.trackName}</span>}
          {person.isTeamMember && person.role !== 'member' && <span className="person-card-track">Also team member</span>}
        </div>
      </div>
      <div className="person-card-badges">
        {person.discordLinked && <span className="person-card-badge" title={`Discord: ${person.discordUsername}`}>🎮</span>}
        {handleCount > 0 && <span className="person-card-badge" title={`${handleCount} social handle${handleCount !== 1 ? 's' : ''}`}>🔗</span>}
      </div>
    </Link>
  )
}

export default function PeopleClient({ staff, members, canSeeStaff }: { staff: PersonCard[]; members: PersonCard[]; canSeeStaff: boolean }) {
  const searchParams = useSearchParams()
  const view = canSeeStaff ? (searchParams.get('view') ?? 'staff') : 'members'
  const list = view === 'members' ? members : staff

  return (
    <>
      <style>{`
        .person-tabs { display: flex; gap: 0; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.08); width: fit-content; }
        .person-tab { padding: 9px 18px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; text-decoration: none; color: var(--grey-mid); background: none; transition: all 0.15s ease; }
        .person-tab.active { background: rgba(219,103,39,0.1); color: var(--orange); }
        .person-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
        .person-card { display: flex; align-items: center; gap: 14px; padding: 16px; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); text-decoration: none; transition: all 0.15s ease; }
        .person-card:hover { border-color: rgba(219,103,39,0.3); background: rgba(219,103,39,0.03); }
        .person-card-avatar { flex-shrink: 0; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(219,103,39,0.12); color: var(--orange); font-family: var(--font-mono); font-size: 13px; font-weight: 700; border-radius: 2px; }
        .person-card-body { flex: 1; min-width: 0; }
        .person-card-name { font-size: 14px; color: var(--white); text-transform: capitalize; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .person-card-email { font-size: 11px; color: var(--grey-mid); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
        .person-card-meta { display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
        .person-card-role { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--orange); }
        .person-card-track { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--grey-dark); }
        .person-card-badges { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; font-size: 13px; }
        .person-empty { padding: 40px; text-align: center; color: var(--grey-mid); font-size: 13px; }
      `}</style>

      <div className="person-tabs">
        {canSeeStaff && <Link href="/dashboard/people" className={`person-tab ${view !== 'members' ? 'active' : ''}`}>Staff ({staff.length})</Link>}
        <Link href="/dashboard/people?view=members" className={`person-tab ${view === 'members' ? 'active' : ''}`}>General Team Members ({members.length})</Link>
      </div>

      {list.length === 0 ? (
        <div className="person-empty">No {view === 'members' ? 'team members' : 'staff'} yet.</div>
      ) : (
        <div className="person-grid">
          {list.map((person) => <PersonCardItem key={person.userId} person={person} />)}
        </div>
      )}
    </>
  )
}
