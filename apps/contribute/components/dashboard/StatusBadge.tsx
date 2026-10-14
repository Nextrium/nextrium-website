import type { SubmissionTone } from '@/lib/submissionView'
import { F, tint } from '@/lib/theme'

export const TONE_TOKEN: Record<SubmissionTone, string> = {
  pending: '--gold-l',
  progress: '--slate-l',
  good: '--teal-l',
  action: '--orange-w',
  bad: '--error',
}

export default function StatusBadge({ tone, children }: { tone: SubmissionTone; children: React.ReactNode }) {
  const token = TONE_TOKEN[tone]
  return (
    <span
      style={{
        padding: '3px 10px',
        borderRadius: 20,
        background: tint(token, 12),
        color: `var(${token})`,
        border: `1px solid ${tint(token, 28)}`,
        fontFamily: F.body,
        fontSize: 9,
        fontWeight: 500,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  )
}
