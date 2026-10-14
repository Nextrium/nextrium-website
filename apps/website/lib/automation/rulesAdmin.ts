import type { GuildRole } from './discordRoles'

// The tracks applications are screened into. Kept in one place so the rules
// screen and any future check agree on the exact names.
export const APPLICATION_TRACKS = [
  'Technical Engineering',
  'Research and Strategy',
  'Operations',
  'Product and Design',
  'Community and Events',
]

export const ASSIGN_ACTION = 'discord.assign_role'
export const REMOVE_ACTION = 'discord.remove_roles'
export const SYNC_TRIGGER = 'member.access_sync'
export const REVOKE_TRIGGER = 'member.access_revoked'

const SNOWFLAKE = /^\d{15,25}$/

export interface RuleInput {
  name: string
  // null = everyone with dashboard access; otherwise only people on that track.
  track: string | null
  roleId: string
}

export type ValidatedRule =
  | { ok: true; value: { name: string; trigger_config: Record<string, unknown>; action_config: Record<string, unknown> } }
  | { ok: false; error: string }

/** Checks a rule submitted from the screen against the real server roles. */
export function validateRuleInput(input: RuleInput, roles: GuildRole[], trackNames: string[]): ValidatedRule {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  if (name.length < 1 || name.length > 80) return { ok: false, error: 'Give the rule a name (up to 80 characters).' }

  let track: string | null = null
  if (input.track !== null && input.track !== '') {
    if (typeof input.track !== 'string' || !trackNames.includes(input.track)) {
      return { ok: false, error: 'Choose a valid track, or Everyone.' }
    }
    track = input.track
  }

  if (typeof input.roleId !== 'string' || !SNOWFLAKE.test(input.roleId)) {
    return { ok: false, error: 'Choose a Discord role.' }
  }
  const role = roles.find((r) => r.id === input.roleId)
  if (!role) return { ok: false, error: 'That Discord role no longer exists.' }
  if (!role.assignable) {
    return { ok: false, error: `The bot can't assign "${role.name}". Move the bot's role above it in the Discord server settings.` }
  }

  return {
    ok: true,
    value: {
      name,
      trigger_config: track ? { track } : {},
      action_config: { roleId: role.id },
    },
  }
}

/** Every role any assignment rule (even a switched-off one) has handed out: what archiving removes. */
export function removalRoleIds(rules: Array<{ action_type: string; action_config: any }>): string[] {
  const ids = new Set<string>()
  for (const r of rules) {
    if (r.action_type === ASSIGN_ACTION && typeof r.action_config?.roleId === 'string' && SNOWFLAKE.test(r.action_config.roleId)) {
      ids.add(r.action_config.roleId)
    }
  }
  return [...ids]
}
