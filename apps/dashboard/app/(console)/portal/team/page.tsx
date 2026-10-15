import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/dashboard/Header'
import { PORTAL_CSS } from '@/components/portal/portalStyles'
import { community, requirePortalStaff } from '@/lib/portal/server'
import { CORE_ROLE_LABELS, type CoreRole } from '@/lib/portal/teamRules'
import { AddMemberForm, MemberControls } from './TeamControls'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Portal core team' }

export default async function PortalTeamPage() {
  const auth = await requirePortalStaff()
  if ('error' in auth) notFound()
  const isAdmin = auth.caller.role === 'admin'

  const { data, error } = await community().from('core_team').select('id, name, email, role, department, is_active, user_id, joined_at').order('is_active', { ascending: false }).order('joined_at')
  if (error) throw new Error('Could not load the core team')
  const members = data ?? []

  return (
    <>
      <style>{PORTAL_CSS}</style>
      <Header title="Portal core team" description="Who joins the portal pre-approved and is credited on verifications" action={<Link href="/portal" className="pt-btn ghost">Portal overview</Link>} />
      <div className="dash-content">
        <div className="pt-alert info" style={{ marginBottom: 18 }}>
          Core team members are approved automatically when they register on the portal (matched by email), and their name is recorded on decisions they make here.
          {!isAdmin && ' Only admins can change the core team.'}
        </div>
        <div className="pt-table-wrap" style={{ marginBottom: 24 }}>
          <table className="pt-table">
            <thead><tr><th>Member</th><th>Role</th><th>Department</th><th>Status</th>{isAdmin && <th></th>}</tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.name}</strong><div className="pt-muted">{m.email}{m.user_id ? '' : ' · has not signed in yet'}</div></td>
                  <td className="pt-muted">{CORE_ROLE_LABELS[m.role as CoreRole] ?? m.role}</td>
                  <td className="pt-muted" style={{ textTransform: 'capitalize' }}>{m.department}</td>
                  <td><span className={`pt-badge ${m.is_active ? 'good' : ''}`}>{m.is_active ? 'Active' : 'Inactive'}</span></td>
                  {isAdmin && <td><MemberControls id={m.id} role={m.role} department={m.department} active={!!m.is_active} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isAdmin && <AddMemberForm />}
      </div>
    </>
  )
}
