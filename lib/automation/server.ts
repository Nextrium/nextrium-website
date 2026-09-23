import { createServiceClient } from '@/lib/supabase/server'
import { runEvent, type ActionHandler, type EngineDeps, type RuleOutcome, type SubjectContext } from './engine'
import { createDiscordAssignRole } from './discordAssignRole'
import { createDiscordRemoveRoles } from './discordRemoveRoles'

// Fired whenever something that affects a person's outside access changes:
// they link Discord, their track changes, or they ask for a re-check.
export const ACCESS_SYNC = 'member.access_sync'
// Fired when someone's dashboard access is archived.
export const ACCESS_REVOKED = 'member.access_revoked'

const SUBJECT_TYPE = 'dashboard_user'

// The tables are not in the generated types, so this uses the untyped client.
function db() {
  return createServiceClient() as any
}

/** A staff track wins; otherwise the track from their application's screening. */
async function resolveTrack(row: any): Promise<string | null> {
  if (row.staff_track_id) {
    const { data } = await db().from('staff_tracks').select('name').eq('id', row.staff_track_id).maybeSingle()
    if (data?.name) return data.name
  }
  if (row.application_id) {
    const { data } = await db().from('agent_screening_results').select('evaluation_track')
      .eq('application_id', row.application_id).order('screened_at', { ascending: false }).limit(1).maybeSingle()
    return data?.evaluation_track ?? null
  }
  return null
}

function buildHandlers(): Record<string, ActionHandler> {
  const botToken = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.DISCORD_GUILD_ID
  const notConfigured: ActionHandler = async () => ({ status: 'failed', detail: 'Discord is not configured on the server.' })
  return {
    'discord.assign_role': botToken && guildId
      ? createDiscordAssignRole({ fetchFn: fetch, botToken, guildId, verifiedRoleId: process.env.DISCORD_VERIFIED_ROLE_ID || undefined })
      : notConfigured,
    'discord.remove_roles': botToken && guildId
      ? createDiscordRemoveRoles({ fetchFn: fetch, botToken, guildId })
      : notConfigured,
  }
}

function createDeps(): EngineDeps {
  return {
    async loadRules(triggerType) {
      const { data } = await db().from('automation_rules')
        .select('id, name, trigger_type, trigger_config, action_type, action_config')
        .eq('trigger_type', triggerType).eq('enabled', true).order('created_at', { ascending: true })
      return data ?? []
    },

    async loadContext(userId): Promise<SubjectContext | null> {
      const { data: row } = await db().from('dashboard_users').select('*').eq('user_id', userId).maybeSingle()
      if (!row) return null
      return {
        userId,
        role: row.role,
        isTeamMember: !!row.is_team_member || row.role === 'member',
        archived: !!row.archived,
        discordUserId: row.discord_user_id ?? null,
        track: await resolveTrack(row),
      }
    },

    // If the log can't be read, treat the rule as already done rather than risk repeating an action.
    async hasSuccess(ruleId, userId) {
      const { count, error } = await db().from('automation_log').select('id', { count: 'exact', head: true })
        .eq('rule_id', ruleId).eq('subject_type', SUBJECT_TYPE).eq('subject_id', userId).eq('status', 'success')
      return error ? true : (count ?? 0) > 0
    },

    async record(ruleId, userId, result) {
      // Waiting and failed results are logged only when they change, so repeated checks don't pile up rows.
      if (result.status !== 'success') {
        const { data: last } = await db().from('automation_log').select('status, detail')
          .eq('rule_id', ruleId).eq('subject_type', SUBJECT_TYPE).eq('subject_id', userId)
          .order('ran_at', { ascending: false }).limit(1).maybeSingle()
        if (last && last.status === result.status && last.detail?.message === result.detail) return
      }
      const { error } = await db().from('automation_log').insert({
        rule_id: ruleId, subject_type: SUBJECT_TYPE, subject_id: userId,
        status: result.status, detail: { message: result.detail },
      })
      // 23505: a parallel run already recorded the success. Nothing to do.
      if (error && error.code !== '23505') throw new Error(error.message)
    },

    handlers: buildHandlers(),
  }
}

/** Never throws: an automation problem must not break the action that triggered it. */
export async function emitAutomationEvent(triggerType: string, userId: string): Promise<RuleOutcome[]> {
  try {
    return await runEvent(createDeps(), triggerType, userId, {
      archivedOnly: triggerType === ACCESS_REVOKED,
      requireDiscordLink: triggerType === ACCESS_SYNC,
    })
  } catch (err) {
    console.error('[automation] event failed:', err instanceof Error ? err.message : err)
    return []
  }
}

/**
 * Retires this person's earlier "done" records so their rules can run afresh
 * (for example when access is restored after being archived). Rows are
 * marked, not deleted, so the history stays.
 */
export async function supersedeSuccesses(userId: string): Promise<void> {
  try {
    await db().from('automation_log').update({ status: 'superseded' })
      .eq('subject_type', SUBJECT_TYPE).eq('subject_id', userId).eq('status', 'success')
  } catch (err) {
    console.error('[automation] could not retire earlier results:', err instanceof Error ? err.message : err)
  }
}
