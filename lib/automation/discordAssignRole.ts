import type { ActionHandler } from './engine'

const API = 'https://discord.com/api/v10'
const TIMEOUT_MS = 10_000
const SNOWFLAKE = /^\d{15,25}$/

export interface DiscordAssignOptions {
  fetchFn: typeof fetch
  botToken: string
  guildId: string
  // Members must hold this role (your server's verification role) before
  // they are given anything. When unset, Discord's own "pending" flag is used.
  verifiedRoleId?: string
}

/**
 * action_type "discord.assign_role". action_config: { roleId, requireVerified? }.
 * Only gives the role once the person is in the server and verified there;
 * until then it reports "waiting" so a later sync can finish the job.
 */
export function createDiscordAssignRole(options: DiscordAssignOptions): ActionHandler {
  const headers = { Authorization: `Bot ${options.botToken}` }

  return async (ctx, config) => {
    const roleId = config.roleId
    if (typeof roleId !== 'string' || !SNOWFLAKE.test(roleId)) {
      return { status: 'failed', detail: 'This rule has no valid Discord role set.' }
    }
    if (!ctx.discordUserId) {
      return { status: 'waiting', detail: 'Connect your Discord account first.' }
    }

    const memberUrl = `${API}/guilds/${options.guildId}/members/${ctx.discordUserId}`
    const memberRes = await options.fetchFn(memberUrl, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (memberRes.status === 404) {
      return { status: 'waiting', detail: 'Join the Nextrium Discord server first.' }
    }
    if (memberRes.status === 429) return { status: 'waiting', detail: 'Discord is busy. Try again in a minute.' }
    if (!memberRes.ok) return { status: 'failed', detail: `Could not read the server member (${memberRes.status}).` }

    const member = await memberRes.json().catch(() => null)
    const roles: string[] = Array.isArray(member?.roles) ? member.roles : []

    const needsVerified = config.requireVerified !== false
    if (needsVerified) {
      const verified = options.verifiedRoleId ? roles.includes(options.verifiedRoleId) : member?.pending !== true
      if (!verified) return { status: 'waiting', detail: 'Complete verification in the Discord server first.' }
    }

    if (roles.includes(roleId)) return { status: 'success', detail: 'Already has the role.' }

    const assignRes = await options.fetchFn(`${memberUrl}/roles/${roleId}`, {
      method: 'PUT',
      headers: { ...headers, 'X-Audit-Log-Reason': encodeURIComponent('Nextrium track access') },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (assignRes.status === 204 || assignRes.ok) return { status: 'success', detail: 'Role assigned.' }
    if (assignRes.status === 429) return { status: 'waiting', detail: 'Discord is busy. Try again in a minute.' }
    if (assignRes.status === 403) {
      return { status: 'failed', detail: 'The bot is not allowed to assign that role. Move the bot\'s role above it in the server settings.' }
    }
    if (assignRes.status === 404) return { status: 'failed', detail: 'That Discord role no longer exists.' }
    return { status: 'failed', detail: `Discord refused the role change (${assignRes.status}).` }
  }
}
