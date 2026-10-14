import {
  CODE_TTL_MS, CODE_WINDOW_MS, IP_WINDOW_MS, MAX_CODE_ATTEMPTS,
  MAX_CODES_PER_EMAIL_WINDOW, MAX_REQUESTS_PER_IP_WINDOW,
  generateCode, hashCode, hashEmail, isPlausibleEmail, normalizeEmail, safeEqualHex,
} from './reportAccess'

export interface CodeRow {
  id: string
  code_hash: string
  attempts: number
}

export interface CodeStore {
  countByEmailSince(emailHash: string, sinceIso: string): Promise<number>
  countByIpSince(ipHash: string, sinceIso: string): Promise<number>
  insert(row: { email_hash: string; ip_hash: string; code_hash: string; sent: boolean; expires_at: string }): Promise<string | null>
  markSent(id: string): Promise<void>
  findUsable(emailHash: string, nowIso: string): Promise<CodeRow | null>
  bumpAttempts(id: string, expectedAttempts: number): Promise<boolean>
  markUsed(id: string): Promise<boolean>
}

export interface ApplicantLookup {
  email: string
  archived: boolean
}

export type IssueResult =
  | { status: 'invalid_email' }
  // Same result whether or not the address matched, so the response reveals nothing.
  // `pending` (present only when a code should actually be delivered) is run after the response.
  | { status: 'accepted'; pending?: () => Promise<void> }

/**
 * Records a code request and, only when the email is the one on the report's
 * application, prepares delivery of a fresh code. Every path returns the same
 * shape to the caller.
 */
export async function issueCode(
  deps: {
    store: CodeStore
    lookup: (reportId: string) => Promise<ApplicantLookup | null>
    deliver: (email: string, code: string) => Promise<boolean>
    now?: number
  },
  input: { reportId: string; email: string; ipHash: string },
): Promise<IssueResult> {
  const now = deps.now ?? Date.now()
  const email = normalizeEmail(input.email)
  if (!isPlausibleEmail(email)) return { status: 'invalid_email' }
  const emailHash = hashEmail(email)

  const [byEmail, byIp] = await Promise.all([
    deps.store.countByEmailSince(emailHash, new Date(now - CODE_WINDOW_MS).toISOString()),
    deps.store.countByIpSince(input.ipHash, new Date(now - IP_WINDOW_MS).toISOString()),
  ])
  if (byEmail >= MAX_CODES_PER_EMAIL_WINDOW || byIp >= MAX_REQUESTS_PER_IP_WINDOW) {
    return { status: 'accepted' }
  }

  const applicant = await deps.lookup(input.reportId)
  const matches = !!applicant
    && !applicant.archived
    && safeEqualHex(hashEmail(applicant.email), emailHash)

  // Every request is recorded (so limits apply equally to any address); only a
  // matching one gets a real, deliverable code.
  const code = generateCode()
  const id = await deps.store.insert({
    email_hash: emailHash,
    ip_hash: input.ipHash,
    code_hash: hashCode(emailHash, code),
    sent: false,
    expires_at: new Date(now + CODE_TTL_MS).toISOString(),
  })
  if (!matches || !id || !applicant) return { status: 'accepted' }

  return {
    status: 'accepted',
    pending: async () => {
      const delivered = await deps.deliver(applicant.email, code)
      if (delivered) await deps.store.markSent(id)
    },
  }
}

/** Checks a submitted code. Returns the verified email hash on success. */
export async function redeemCode(
  deps: { store: CodeStore; now?: number },
  input: { email: string; code: string },
): Promise<{ ok: true; emailHash: string } | { ok: false }> {
  const now = deps.now ?? Date.now()
  const email = normalizeEmail(input.email)
  if (!isPlausibleEmail(email) || !/^\d{6}$/.test(input.code)) return { ok: false }
  const emailHash = hashEmail(email)

  const row = await deps.store.findUsable(emailHash, new Date(now).toISOString())
  if (!row || row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false }

  // Count the attempt before comparing, and only proceed if this call won the
  // increment, so parallel guesses can't exceed the limit.
  if (!(await deps.store.bumpAttempts(row.id, row.attempts))) return { ok: false }

  if (!safeEqualHex(row.code_hash, hashCode(emailHash, input.code))) return { ok: false }
  if (!(await deps.store.markUsed(row.id))) return { ok: false }
  return { ok: true, emailHash }
}
