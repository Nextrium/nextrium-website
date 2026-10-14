import { createServiceClient } from '@nextrium/supabase/server'
import Header from '@/components/dashboard/Header'
import Link from 'next/link'
import type { TeamMember } from '@nextrium/supabase/database'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Team' }

async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('team_members')
    .select('*')
    .order('sort_order', { ascending: true })
  return (data ?? []) as TeamMember[]
}

export default async function TeamPage() {
  const members = await getTeamMembers()

  return (
    <>
      <style>{`
        .dash-list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .dash-list-count { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #B0BEC5; }
        .dash-new-btn { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; padding: 10px 20px; background: var(--orange); color: var(--white); border: none; text-decoration: none; cursor: pointer; transition: background 0.15s ease; display: inline-flex; align-items: center; gap: 8px; }
        .dash-new-btn:hover { background: var(--orange-f); }
        .dash-table { width: 100%; border-collapse: collapse; }
        .dash-table th { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #B0BEC5; padding: 10px 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); background: var(--navy); white-space: nowrap; }
        .dash-table td { padding: 14px 16px; font-size: 14px; color: #E8EDF2; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        .dash-table tr:hover td { background: rgba(255,255,255,0.02); }
        .dash-table tr:last-child td { border-bottom: none; }
        .dash-table-wrap { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); }
        .dash-badge { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 8px; display: inline-block; white-space: nowrap; }
        .dash-edit-link { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-mid); text-decoration: none; padding: 5px 10px; border: 1px solid rgba(255,255,255,0.08); transition: all 0.15s ease; display: inline-block; }
        .dash-edit-link:hover { color: var(--white); border-color: rgba(255,255,255,0.2); }
        .dash-empty-state { padding: 64px 32px; text-align: center; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); }
        .dash-empty-title { font-family: var(--font-exo2); font-weight: 700; font-size: 20px; color: var(--white); margin-bottom: 8px; }
        .dash-empty-desc { font-size: 14px; color: var(--grey-mid); margin-bottom: 24px; }
        .member-avatar { width: 36px; height: 36px; border-radius: 2px; background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; font-family: var(--font-exo2); font-weight: 700; font-size: 14px; color: var(--orange); overflow: hidden; flex-shrink: 0; }
        .member-avatar img { width: 100%; height: 100%; object-fit: cover; }
      `}</style>

      <Header
        title="Team"
        description="Manage core team members shown on the team page"
        action={<Link href="/team/new" className="dash-new-btn">+ Add member</Link>}
      />

      <div className="dash-content">
        {members.length === 0 ? (
          <div className="dash-empty-state">
            <div className="dash-empty-title">No team members yet.</div>
            <div className="dash-empty-desc">Add your first core team member.</div>
            <Link href="/team/new" className="dash-new-btn">+ Add member</Link>
          </div>
        ) : (
          <>
            <div className="dash-list-header">
              <span className="dash-list-count">{members.length} member{members.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.slug}>
                      <td style={{ color: 'var(--grey-dark)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{member.sort_order}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="member-avatar">
                            {member.photo_url
                              ? <img src={member.photo_url} alt={member.name} />
                              : member.name.charAt(0)
                            }
                          </div>
                          <div style={{ fontWeight: 500, color: 'var(--white)' }}>{member.name}</div>
                        </div>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--grey-mid)' }}>{member.role}</td>
                      <td>
                        <span className="dash-badge" style={member.is_active
                          ? { background: 'color-mix(in srgb, var(--success) 10%, transparent)', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)' }
                          : { background: 'color-mix(in srgb, var(--grey-mid) 10%, transparent)', color: 'var(--grey-mid)', border: '1px solid color-mix(in srgb, var(--grey-mid) 20%, transparent)' }
                        }>
                          {member.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <Link href={`/team/${member.slug}`} className="dash-edit-link">Edit →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}