'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@nextrium/supabase/server'
import { logActivity } from '@/lib/activityLog'
import { getVerifiedIdentity } from '@/lib/dashboard/getRole'
import { isRestricted } from '@/lib/dashboard/accessControl'
import { savePostPins } from '@/lib/dashboard/pins'

/** Replaces the ordered pinned posts of one site. Anyone who may manage posts may pin. */
export async function setPostPins(site: unknown, postIds: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await getVerifiedIdentity()
  if (!me || isRestricted('/posts', me.role)) return { ok: false, error: 'You do not have permission to do this.' }
  const res = await savePostPins(createServiceClient(), me.userId, site, postIds)
  if (!res.ok) return res
  logActivity({ action: 'post_pins_updated', targetType: 'post_pins', targetId: String(site), details: { site, posts: res.ids }, actorId: me.userId, actorEmail: me.email ?? undefined }).catch(() => {})
  revalidatePath('/posts')
  return { ok: true }
}
