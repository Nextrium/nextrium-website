'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getVerifiedIdentity } from '@/lib/dashboard/getRole'
import { logActivity } from '@/lib/activityLog'
import { listGuildRoles, type GuildRole } from '@/lib/automation/discordRoles'
import {
  APPLICATION_TRACKS, ASSIGN_ACTION, REMOVE_ACTION, REVOKE_TRIGGER, SYNC_TRIGGER,
  removalRoleIds, validateRuleInput,
} from '@/lib/automation/rulesAdmin'

// Everything here decides who gets which Discord access, so every action is
// admin-only, checked with a verified identity inside the action itself.
const NOT_ALLOWED = 'You do not have permission to do this.'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireAdmin(): Promise<{ userId: string } | null> {
  const me = await getVerifiedIdentity()
  return me && me.role === 'admin' ? { userId: me.userId } : null
}

function db() {
  return createServiceClient() as any
}

async function loadRoles(): Promise<{ roles: GuildRole[] } | { error: string }> {
  const token = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.DISCORD_GUILD_ID
  if (!token || !guildId) return { error: 'Discord is not configured on the server.' }
  const res = await listGuildRoles(fetch, token, guildId)
  return res.ok ? { roles: res.roles } : { error: res.error }
}

export interface RuleRow {
  id: string
  name: string
  track: string | null
  roleId: string | null
  enabled: boolean
}

/** The server's roles, for the role pickers. */
export async function getDiscordRoles(): Promise<{ roles?: GuildRole[]; error?: string }> {
  if (!(await requireAdmin())) return { error: NOT_ALLOWED }
  const res = await loadRoles()
  return 'error' in res ? { error: res.error } : { roles: res.roles }
}

// Keeps the archive rule in step with the assignment rules, so any role the
// screen can hand out is also taken back when someone's access is archived.
async function syncRemovalRule(): Promise<void> {
  const client = db()
  const { data: rules } = await client.from('automation_rules').select('action_type, action_config').eq('action_type', ASSIGN_ACTION)
  const roleIds = removalRoleIds(rules ?? [])
  const { data: existing } = await client.from('automation_rules').select('id').eq('trigger_type', REVOKE_TRIGGER).eq('action_type', REMOVE_ACTION).limit(1)
  if (existing && existing.length > 0) {
    await client.from('automation_rules').update({ action_config: { roleIds }, updated_at: new Date().toISOString() }).eq('id', existing[0].id)
  } else if (roleIds.length > 0) {
    await client.from('automation_rules').insert({
      name: 'Remove Discord roles when access is archived',
      trigger_type: REVOKE_TRIGGER, trigger_config: {},
      action_type: REMOVE_ACTION, action_config: { roleIds }, enabled: true,
    })
  }
}

export async function createRule(input: { name: string; track: string | null; roleId: string }): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin()
    if (!admin) return { error: NOT_ALLOWED }
    const loaded = await loadRoles()
    if ('error' in loaded) return { error: loaded.error }
    const checked = validateRuleInput(input, loaded.roles, APPLICATION_TRACKS)
    if (!checked.ok) return { error: checked.error }

    const { error } = await db().from('automation_rules').insert({
      name: checked.value.name,
      trigger_type: SYNC_TRIGGER,
      trigger_config: checked.value.trigger_config,
      action_type: ASSIGN_ACTION,
      action_config: checked.value.action_config,
      enabled: true,
      created_by: admin.userId,
    })
    if (error) return { error: 'Could not save the rule.' }

    await syncRemovalRule()
    await logActivity({ action: 'automation_rule_created', targetType: 'automation_rule', details: { name: checked.value.name } })
    revalidatePath('/dashboard/settings/automations')
    return {}
  } catch {
    return { error: 'Something went wrong. Try again.' }
  }
}

export async function updateRule(
  ruleId: string,
  input: { name: string; track: string | null; roleId: string },
): Promise<{ error?: string }> {
  try {
    if (!(await requireAdmin())) return { error: NOT_ALLOWED }
    if (typeof ruleId !== 'string' || !UUID.test(ruleId)) return { error: 'Unknown rule.' }
    const loaded = await loadRoles()
    if ('error' in loaded) return { error: loaded.error }
    const checked = validateRuleInput(input, loaded.roles, APPLICATION_TRACKS)
    if (!checked.ok) return { error: checked.error }

    // Only role-assignment rules can be edited here.
    const { data, error } = await db().from('automation_rules').update({
      name: checked.value.name,
      trigger_config: checked.value.trigger_config,
      action_config: checked.value.action_config,
      updated_at: new Date().toISOString(),
    }).eq('id', ruleId).eq('trigger_type', SYNC_TRIGGER).eq('action_type', ASSIGN_ACTION).select('id')
    if (error) return { error: 'Could not save the rule.' }
    if (!data || data.length === 0) return { error: 'Unknown rule.' }

    await syncRemovalRule()
    await logActivity({ action: 'automation_rule_updated', targetType: 'automation_rule', targetId: ruleId, details: { name: checked.value.name } })
    revalidatePath('/dashboard/settings/automations')
    return {}
  } catch {
    return { error: 'Something went wrong. Try again.' }
  }
}

export async function setRuleEnabled(ruleId: string, enabled: boolean): Promise<{ error?: string }> {
  try {
    if (!(await requireAdmin())) return { error: NOT_ALLOWED }
    if (typeof ruleId !== 'string' || !UUID.test(ruleId) || typeof enabled !== 'boolean') return { error: 'Unknown rule.' }

    const { data, error } = await db().from('automation_rules')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('id', ruleId).eq('trigger_type', SYNC_TRIGGER).select('id, name')
    if (error) return { error: 'Could not update the rule.' }
    if (!data || data.length === 0) return { error: 'Unknown rule.' }

    await logActivity({ action: 'automation_rule_toggled', targetType: 'automation_rule', targetId: ruleId, details: { name: data[0].name, enabled } })
    revalidatePath('/dashboard/settings/automations')
    return {}
  } catch {
    return { error: 'Something went wrong. Try again.' }
  }
}
