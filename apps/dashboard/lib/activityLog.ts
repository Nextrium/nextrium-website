import { createClient, createServiceClient } from '@nextrium/supabase/server'

export interface LogActivityParams {
  action: string
  targetType?: string
  targetId?: string
  details?: Record<string, unknown>
  /** Override actor identity — use when the session may already be gone (e.g. right after sign-out). */
  actorEmail?: string
  actorId?: string
}

/**
 * Records one row in team_activity_logs. Best-effort: a logging failure
 * must never break the action it's attached to, so every error is caught
 * and swallowed (with a console.error for visibility) rather than thrown.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    let actorId = params.actorId
    let actorEmail = params.actorEmail

    if (!actorId || !actorEmail) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      actorId = actorId ?? user?.id
      actorEmail = actorEmail ?? user?.email ?? undefined
    }

    const service = createServiceClient()
    const { error } = await (service.from('team_activity_logs') as any).insert({
      actor_id: actorId ?? null,
      actor_email: actorEmail ?? null,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      details: params.details ?? {},
    })

    if (error) {
      console.error('[logActivity] Failed to insert log row:', error.message)
    }
  } catch (err) {
    console.error('[logActivity] Unexpected error:', err)
  }
}
