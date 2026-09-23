import type { ActionHandler } from './engine'
import type { DiscordAssignOptions } from './discordAssignRole'

const API = 'https://discord.com/api/v10'
const TIMEOUT_MS = 10_000
const SNOWFLAKE = /^\d{15,25}$/

/**
 * action_type "discord.remove_roles". action_config: { roleIds: string[] }.
 * Takes those roles away from the person. Removing a role they don't hold,
 * or from someone who isn't in the server, counts as done.
 */
export function createDiscordRemoveRoles(options: Pick<DiscordAssignOptions, 'fetchFn' | 'botToken' | 'guildId'>): ActionHandler {
  const headers = {
    Authorization: `Bot ${options.botToken}`,
    'X-Audit-Log-Reason': encodeURIComponent('Nextrium access removed'),
  }

  return async (ctx, config) => {
    const roleIds = Array.isArray(config.roleIds)
      ? config.roleIds.filter((id): id is string => typeof id === 'string' && SNOWFLAKE.test(id))
      : []
    if (roleIds.length === 0) return { status: 'failed', detail: 'This rule has no valid Discord roles set.' }
    if (!ctx.discordUserId) return { status: 'success', detail: 'No Discord account was connected.' }

    for (const roleId of roleIds) {
      const res = await options.fetchFn(
        `${API}/guilds/${options.guildId}/members/${ctx.discordUserId}/roles/${roleId}`,
        { method: 'DELETE', headers, signal: AbortSignal.timeout(TIMEOUT_MS) },
      )
      if (res.ok || res.status === 404) continue
      if (res.status === 429) return { status: 'waiting', detail: 'Discord is busy. Try again in a minute.' }
      if (res.status === 403) {
        return { status: 'failed', detail: 'The bot is not allowed to remove a role. Move the bot\'s role above it in the server settings.' }
      }
      return { status: 'failed', detail: `Discord refused the role change (${res.status}).` }
    }
    return { status: 'success', detail: 'Roles removed.' }
  }
}
