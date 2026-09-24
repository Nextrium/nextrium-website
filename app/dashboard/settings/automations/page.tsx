import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getVerifiedDashboardRole } from '@/lib/dashboard/getRole'
import { listGuildRoles, type GuildRole } from '@/lib/automation/discordRoles'
import { APPLICATION_TRACKS, ASSIGN_ACTION, SYNC_TRIGGER } from '@/lib/automation/rulesAdmin'
import Header from '@/components/dashboard/Header'
import AutomationsClient from './AutomationsClient'
import type { RuleRow } from './actions'

export const metadata = { title: 'Discord Rules' }
export const dynamic = 'force-dynamic'

export default async function AutomationsPage() {
  if ((await getVerifiedDashboardRole()) !== 'admin') redirect('/dashboard')

  const { data } = await (createServiceClient() as any)
    .from('automation_rules')
    .select('id, name, trigger_config, action_config, enabled')
    .eq('trigger_type', SYNC_TRIGGER)
    .eq('action_type', ASSIGN_ACTION)
    .order('created_at', { ascending: true })

  const rules: RuleRow[] = (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    track: typeof r.trigger_config?.track === 'string' ? r.trigger_config.track : null,
    roleId: typeof r.action_config?.roleId === 'string' ? r.action_config.roleId : null,
    enabled: !!r.enabled,
  }))

  let roles: GuildRole[] = []
  let rolesError = ''
  const token = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.DISCORD_GUILD_ID
  if (!token || !guildId) {
    rolesError = 'Discord is not configured on the server.'
  } else {
    const res = await listGuildRoles(fetch, token, guildId)
    if (res.ok) roles = res.roles
    else rolesError = res.error
  }

  return (
    <>
      <Header title="Discord Rules" description="Choose which Discord roles people receive, by track" />
      <div className="dash-content">
        <AutomationsClient rules={rules} roles={roles} rolesError={rolesError} tracks={APPLICATION_TRACKS} />
      </div>
    </>
  )
}
