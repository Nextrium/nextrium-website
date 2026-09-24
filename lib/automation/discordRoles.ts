const API = 'https://discord.com/api/v10'
const TIMEOUT_MS = 10_000

export interface GuildRole {
  id: string
  name: string
  position: number
  managed: boolean
  // True when the bot may hand this role out: it sits below the bot's own
  // highest role and isn't a bot/integration role or @everyone.
  assignable: boolean
}

export type GuildRolesResult =
  | { ok: true; roles: GuildRole[] }
  | { ok: false; error: string }

/** The server's roles, highest first, with which ones the bot can assign. */
export async function listGuildRoles(fetchFn: typeof fetch, botToken: string, guildId: string): Promise<GuildRolesResult> {
  const headers = { Authorization: `Bot ${botToken}` }
  const get = (path: string) => fetchFn(`${API}${path}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })

  try {
    const rolesRes = await get(`/guilds/${guildId}/roles`)
    if (!rolesRes.ok) return { ok: false, error: `Could not read the server's roles (${rolesRes.status}).` }
    const rawRoles: any[] = await rolesRes.json()

    const meRes = await get('/users/@me')
    if (!meRes.ok) return { ok: false, error: `Could not identify the bot (${meRes.status}).` }
    const me = await meRes.json()

    const memberRes = await get(`/guilds/${guildId}/members/${me.id}`)
    if (!memberRes.ok) return { ok: false, error: 'The bot is not in the server.' }
    const member = await memberRes.json()

    const held: string[] = Array.isArray(member.roles) ? member.roles : []
    const botPosition = Math.max(-1, ...rawRoles.filter((r) => held.includes(r.id)).map((r) => Number(r.position)))

    const roles: GuildRole[] = rawRoles
      .filter((r) => r.id !== guildId)
      .map((r) => ({
        id: String(r.id),
        name: String(r.name),
        position: Number(r.position),
        managed: !!r.managed,
        assignable: Number(r.position) < botPosition && !r.managed,
      }))
      .sort((a, b) => b.position - a.position)
    return { ok: true, roles }
  } catch {
    return { ok: false, error: 'Could not reach Discord.' }
  }
}
