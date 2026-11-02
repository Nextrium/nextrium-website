import { safeNext as sharedSafeNext } from '@nextrium/utils/safeNext'

export function safeNext(raw: unknown, fallback = '/dashboard'): string {
  return sharedSafeNext(raw, fallback)
}
