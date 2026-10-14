'use client'

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral'

const VARIANT_STYLES: Record<BadgeVariant, { color: string; bg: string; border: string }> = {
  success: { color: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 12%, transparent)', border: 'color-mix(in srgb, var(--success) 35%, transparent)' },
  warning: { color: 'var(--gold)',    bg: 'color-mix(in srgb, var(--gold) 12%, transparent)', border: 'color-mix(in srgb, var(--gold) 35%, transparent)' },
  error:   { color: 'var(--error)',   bg: 'color-mix(in srgb, var(--error) 12%, transparent)',  border: 'color-mix(in srgb, var(--error) 35%, transparent)' },
  info:    { color: 'var(--slate)',   bg: 'color-mix(in srgb, var(--slate) 12%, transparent)', border: 'color-mix(in srgb, var(--slate) 35%, transparent)' },
  neutral: { color: 'var(--grey-mid)', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.1)' },
}

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
}

/**
 * Single shared pill/badge, mapped to the existing semantic color tokens
 * (--success/--warning/--error/--slate). Every dashboard page previously
 * hand-rolled its own badge CSS per component, which is how the
 * --grey-dark-on-navy contrast bug happened before — new surfaces (rebuttal
 * status, suggested-action, score-delta) should use this instead of adding
 * another one-off.
 */
export default function Badge({ variant = 'neutral', children }: BadgeProps) {
  const style = VARIANT_STYLES[variant]
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '9px',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '6px 10px',
        display: 'inline-block',
        color: style.color,
        background: style.bg,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
