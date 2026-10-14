import { createServiceClient } from '@nextrium/supabase/server'
import Header from '@/components/dashboard/Header'
import Link from 'next/link'
import type { Role } from '@nextrium/supabase/database'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Roles' }

const TYPE_LABELS: Record<Role['type'], string> = {
  full_time:  'Full-time',
  contract:   'Contract',
  volunteer:  'Volunteer',
  internship: 'Internship',
}

async function getRoles(): Promise<Role[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('roles')
    .select('*')
    .order('sort_order', { ascending: true })
  return data ?? []
}

export default async function RolesPage() {
  const roles = await getRoles()

  return (
    <>
      <style>{`
        .dash-list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .dash-list-count { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); }
        .dash-new-btn { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; padding: 10px 20px; background: var(--orange); color: var(--white); border: none; text-decoration: none; cursor: pointer; transition: background 0.15s ease; display: inline-flex; align-items: center; gap: 8px; }
        .dash-new-btn:hover { background: var(--orange-f); }
        .dash-table { width: 100%; border-collapse: collapse; }
        .dash-table th { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); padding: 10px 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); background: var(--navy); white-space: nowrap; }
        .dash-table td { padding: 14px 16px; font-size: 13px; color: var(--off-white); border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        .dash-table tr:hover td { background: rgba(255,255,255,0.02); }
        .dash-table tr:last-child td { border-bottom: none; }
        .dash-table-wrap { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); }
        .dash-badge { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; display: inline-block; white-space: nowrap; }
        .badge-active { background: color-mix(in srgb, var(--success) 10%, transparent); color: var(--success); border: 1px solid color-mix(in srgb, var(--success) 20%, transparent); }
        .badge-inactive { background: color-mix(in srgb, var(--grey-mid) 10%, transparent); color: var(--grey-mid); border: 1px solid color-mix(in srgb, var(--grey-mid) 20%, transparent); }
        .dash-edit-link { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-mid); text-decoration: none; padding: 5px 10px; border: 1px solid rgba(255,255,255,0.08); transition: all 0.15s ease; display: inline-block; }
        .dash-edit-link:hover { color: var(--white); border-color: rgba(255,255,255,0.2); }
        .dash-empty-state { padding: 64px 32px; text-align: center; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); }
        .dash-empty-title { font-family: var(--font-exo2); font-weight: 700; font-size: 20px; color: var(--white); margin-bottom: 8px; }
        .dash-empty-desc { font-size: 14px; color: var(--grey-mid); margin-bottom: 24px; }
      `}</style>

      <Header
        title="Roles"
        description="Manage open positions and career listings"
        action={<Link href="/dashboard/roles/new" className="dash-new-btn">+ New role</Link>}
      />

      <div className="dash-content">
        {roles.length === 0 ? (
          <div className="dash-empty-state">
            <div className="dash-empty-title">No roles yet.</div>
            <div className="dash-empty-desc">Post your first open role to get started.</div>
            <Link href="/dashboard/roles/new" className="dash-new-btn">+ New role</Link>
          </div>
        ) : (
          <>
            <div className="dash-list-header">
              <span className="dash-list-count">{roles.length} role{roles.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Team</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Closes</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.slug}>
                      <td style={{ fontWeight: 500, color: 'var(--white)' }}>{role.title}</td>
                      <td style={{ fontSize: '11px', color: 'var(--grey-mid)' }}>{role.team}</td>
                      <td style={{ fontSize: '11px', color: 'var(--grey-mid)' }}>{TYPE_LABELS[role.type]}</td>
                      <td style={{ fontSize: '11px', color: 'var(--grey-mid)' }}>{role.location}</td>
                      <td style={{ fontSize: '11px', color: 'var(--grey-mid)' }}>
                        {role.closes_at
                          ? new Date(role.closes_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Open'}
                      </td>
                      <td>
                        <span className={`dash-badge ${role.is_active ? 'badge-active' : 'badge-inactive'}`}>
                          {role.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <Link href={`/dashboard/roles/${role.slug}`} className="dash-edit-link">Edit →</Link>
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