import { sendEmail } from '@nextrium/email/send'
import { createServiceClient } from '@nextrium/supabase/server'
import { createCommunityServiceClient } from '@nextrium/supabase/community/server'
import { dashboardUrl } from '@/lib/contributions/notify'
import type { AlertDeps } from './server'

/** The real clients and mailer for task alerts. Server-only. */
export function liveAlertDeps(): AlertDeps {
  return {
    db: createServiceClient(),
    community: createCommunityServiceClient(),
    send: sendEmail,
    link: dashboardUrl,
  }
}
