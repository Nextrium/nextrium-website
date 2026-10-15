import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/dashboard/Header'
import { PORTAL_CSS } from '@/components/portal/portalStyles'
import { community, requirePortalStaff } from '@/lib/portal/server'
import { auditActionLabel } from '@/lib/portal/teamRules'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Portal audit log' }

const TYPES = [
  { key: '', label: 'Everything' },
  { key: 'contributor', label: 'Applicants & contributors' },
  { key: 'task', label: 'Tasks' },
  { key: 'contribution', label: 'Submissions' },
  { key: 'core_team', label: 'Core team' },
]

const LINK: Record<string, (id: string) => string> = {
  contributor: (id) => `/portal/applicants/${id}`,
  task: (id) => `/portal/tasks/${id}`,
  contribution: (id) => `/portal/reviews/${id}`,
}

export default async function PortalAuditPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string }> }) {
  // Admin only, like the dashboard's own activity logs.
  const auth = await requirePortalStaff()
  if ('error' in auth || auth.caller.role !== 'admin') notFound()
  const params = await searchParams
  const type = TYPES.some((t) => t.key === params.type) ? params.type ?? '' : ''
  const q = (params.q ?? '').trim().toLowerCase().slice(0, 100)

  let query = community().from('admin_audit_log').select('id, actor_name, action, target_type, target_id, target_label, metadata, created_at').order('created_at', { ascending: false }).limit(500)
  if (type) query = query.eq('target_type', type)
  const { data, error } = await query
  if (error) throw new Error('Could not load the audit log')
  const rows = (data ?? []).filter((r) => !q || [r.actor_name, r.action, r.target_label ?? ''].some((v) => v.toLowerCase().includes(q)))
  const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  const via = (m: unknown) => (m && typeof m === 'object' && (m as Record<string, unknown>).via === 'dashboard' ? 'Dashboard' : 'Old portal admin')

  return (
    <>
      <style>{PORTAL_CSS}</style>
      <Header title="Portal audit log" description="Every staff decision on the contributor portal" action={<Link href="/portal" className="pt-btn ghost">Portal overview</Link>} />
      <div className="dash-content">
        <form className="pt-search" method="get">
          <select name="type" aria-label="Show" defaultValue={type} className="pt-input" style={{ minWidth: 200 }}>
            {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <input name="q" aria-label="Search the log" defaultValue={q} placeholder="Search person, action or item" className="pt-input" />
          <button type="submit" className="pt-btn ghost">Filter</button>
        </form>
        {rows.length === 0 ? (
          <div className="pt-empty">No entries.</div>
        ) : (
          <div className="pt-table-wrap">
            <table className="pt-table">
              <thead><tr><th>When</th><th>Who</th><th>What</th><th>Item</th><th>From</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const href = r.target_type && r.target_id && LINK[r.target_type] ? LINK[r.target_type](r.target_id) : null
                  return (
                    <tr key={r.id}>
                      <td className="pt-muted" style={{ whiteSpace: 'nowrap' }}>{fmt(r.created_at)}</td>
                      <td>{r.actor_name}</td>
                      <td>{auditActionLabel(r.action)}</td>
                      <td>{href ? <Link href={href} className="title">{r.target_label ?? r.target_id}</Link> : <span className="pt-muted">{r.target_label ?? '—'}</span>}</td>
                      <td className="pt-muted">{via(r.metadata)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
