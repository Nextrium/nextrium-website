'use server'

import { revalidatePath } from 'next/cache'
import { UUID, auditPortal, community, requirePortalStaff } from '@/lib/portal/server'
import { CORE_ROLES, DEPARTMENTS, parseCoreMember, type CoreRole, type Department } from '@/lib/portal/teamRules'

type Result = { ok: true; message: string } | { ok: false; error: string }

// The core team decides who joins the portal pre-approved (matched by email)
// and is credited on verifications. Until the old portal's admin is retired,
// membership also opens that console, so every change here is admin-only.
async function requireAdmin() {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { error: auth.error }
  if (auth.caller.role !== 'admin') return { error: 'Only admins can change the core team.' }
  return { caller: auth.caller }
}

function refresh() {
  revalidatePath('/portal/team')
}

export async function addCoreMember(raw: { name?: unknown; email?: unknown; role?: unknown; department?: unknown }): Promise<Result> {
  const auth = await requireAdmin()
  if ('error' in auth) return { ok: false, error: auth.error as string }
  const parsed = parseCoreMember(raw)
  if ('error' in parsed) return { ok: false, error: parsed.error }
  const m = parsed.member

  const { data, error } = await community().from('core_team').insert({ name: m.name, email: m.email, role: m.role, department: m.department, is_active: true }).select('id').single()
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Someone with that email is already on the core team.' }
    console.error('[portal] core team add failed:', error.code)
    return { ok: false, error: 'Could not add the member.' }
  }
  await auditPortal(auth.caller, { action: 'core_team.member_added', targetType: 'core_team', targetId: data.id, targetLabel: m.name, metadata: { email: m.email, role: m.role, department: m.department } })
  refresh()
  return { ok: true, message: `${m.name} added to the core team.` }
}

export async function updateCoreMember(id: string, role: unknown, department: unknown): Promise<Result> {
  const auth = await requireAdmin()
  if ('error' in auth) return { ok: false, error: auth.error as string }
  if (!UUID.test(id)) return { ok: false, error: 'That member could not be found.' }
  if (!(CORE_ROLES as readonly string[]).includes(role as string)) return { ok: false, error: 'Choose a role.' }
  if (!(DEPARTMENTS as readonly string[]).includes(department as string)) return { ok: false, error: 'Choose a department.' }

  const db = community()
  const { data: member } = await db.from('core_team').select('id, name, role, department, is_active').eq('id', id).maybeSingle()
  if (!member) return { ok: false, error: 'That member could not be found.' }
  if (member.role === 'founder' && role !== 'founder' && (await activeFounders()) <= 1 && member.is_active) {
    return { ok: false, error: 'The core team needs at least one active founder.' }
  }
  const { error } = await db.from('core_team').update({ role: role as CoreRole, department: department as Department }).eq('id', id)
  if (error) return { ok: false, error: 'Could not save the change.' }
  await auditPortal(auth.caller, { action: 'core_team.role_updated', targetType: 'core_team', targetId: id, targetLabel: member.name, metadata: { from: { role: member.role, department: member.department }, to: { role, department } } })
  refresh()
  return { ok: true, message: `${member.name} updated.` }
}

async function activeFounders(): Promise<number> {
  const { count } = await community().from('core_team').select('id', { count: 'exact', head: true }).eq('role', 'founder').eq('is_active', true)
  return count ?? 0
}

export async function setCoreMemberActive(id: string, active: boolean): Promise<Result> {
  const auth = await requireAdmin()
  if ('error' in auth) return { ok: false, error: auth.error as string }
  if (!UUID.test(id) || typeof active !== 'boolean') return { ok: false, error: 'Invalid request.' }

  const db = community()
  const { data: member } = await db.from('core_team').select('id, name, role, is_active').eq('id', id).maybeSingle()
  if (!member) return { ok: false, error: 'That member could not be found.' }
  if (member.is_active === active) return { ok: true, message: 'No change.' }
  if (!active && member.role === 'founder' && (await activeFounders()) <= 1) return { ok: false, error: 'The core team needs at least one active founder.' }

  const { error } = await db.from('core_team').update({ is_active: active }).eq('id', id)
  if (error) return { ok: false, error: 'Could not save the change.' }
  await auditPortal(auth.caller, { action: active ? 'core_team.member_reactivated' : 'core_team.member_deactivated', targetType: 'core_team', targetId: id, targetLabel: member.name })
  refresh()
  return { ok: true, message: `${member.name} ${active ? 'reactivated' : 'deactivated'}.` }
}
