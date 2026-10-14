'use server'

import { logActivity, type LogActivityParams } from '@/lib/activityLog'
import { getVerifiedIdentity } from '@/lib/dashboard/getRole'
import { sanitizeLogInput, canLogAction } from '@/lib/activityLogInput'

// The actor is always taken from the verified session, never from the
// caller's arguments.
export async function logActivityAction(params: LogActivityParams): Promise<void> {
  const input = sanitizeLogInput(params)
  if (!input) return

  const me = await getVerifiedIdentity()
  if (!me || !canLogAction(input.action, me.role)) return

  await logActivity({ ...input, actorId: me.userId, actorEmail: me.email ?? undefined })
}
