import { createServiceClient } from '@nextrium/supabase/server'
import Header from '@/components/dashboard/Header'
import Link from 'next/link'
import type { CommunityProject } from '@nextrium/supabase/database'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Community Projects' }

async function getProjects(): Promise<CommunityProject[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('community_projects')
    .select('*')
    .order('sort_order', { ascending: true })
  return (data ?? []) as CommunityProject[]
}

export default async function CommunityProjectsPage() {
  const projects = await getProjects()

  return (
    <>
      <style>{`
        .dash-list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .dash-list-count { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); }
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
        .color-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; border: 1px solid rgba(255,255,255,0.1); }
      `}</style>

      <Header
        title="Community Projects"
        description="Projects built by Hub teams during events"
        action={<Link href="/dashboard/community-projects/new" className="dash-new-btn">+ New project</Link>}
      />

      <div className="dash-content">
        {projects.length === 0 ? (
          <div className="dash-empty-state">
            <div className="dash-empty-title">No community projects yet.</div>
            <div className="dash-empty-desc">Add the first project from the Hub.</div>
            <Link href="/dashboard/community-projects/new" className="dash-new-btn">+ New project</Link>
          </div>
        ) : (
          <>
            <div className="dash-list-header">
              <span className="dash-list-count">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Name</th>
                    <th>Team</th>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Color</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.slug}>
                      <td style={{ color: 'var(--grey-dark)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{project.sort_order}</td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--white)' }}>{project.name}</div>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--grey-mid)' }}>{project.team}</td>
                      <td style={{ fontSize: '12px', color: 'var(--grey-mid)' }}>{project.event}</td>
                      <td>
                        <span className="dash-badge" style={{ background: 'color-mix(in srgb, var(--success) 10%, transparent)', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)' }}>
                          {project.status}
                        </span>
                      </td>
                      <td>
                        <span className="color-dot" style={{ background: project.cover_color }} title={project.cover_color} />
                      </td>
                      <td>
                        <Link href={`/dashboard/community-projects/${project.slug}`} className="dash-edit-link">Edit →</Link>
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