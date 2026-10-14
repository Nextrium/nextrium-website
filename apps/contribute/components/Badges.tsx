import { CATEGORY_LABELS, COMPLEXITY_LABELS, type Category, type Complexity } from '@nextrium/contributions-core/constants'
import { C, F, categoryToken, tint } from '@/lib/theme'

const base: React.CSSProperties = {
  display: 'inline-block',
  borderRadius: 20,
  fontFamily: F.body,
  fontWeight: 500,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const sizes = {
  sm: { padding: '2px 8px', fontSize: 9 },
  md: { padding: '3px 12px', fontSize: 10 },
} as const

export function CategoryBadge({ category, size = 'sm' }: { category: string; size?: keyof typeof sizes }) {
  const token = categoryToken(category)
  return (
    <span style={{ ...base, ...sizes[size], background: tint(token, 10), color: `var(${token})`, border: `1px solid ${tint(token, 22)}` }}>
      {CATEGORY_LABELS[category as Category] ?? category}
    </span>
  )
}

export function NeutralBadge({ children, size = 'sm' }: { children: React.ReactNode; size?: keyof typeof sizes }) {
  return <span style={{ ...base, ...sizes[size], background: C.border, color: C.mute }}>{children}</span>
}

export function ComplexityBadge({ complexity, size = 'sm' }: { complexity: string; size?: keyof typeof sizes }) {
  return <NeutralBadge size={size}>{COMPLEXITY_LABELS[complexity as Complexity] ?? complexity}</NeutralBadge>
}
