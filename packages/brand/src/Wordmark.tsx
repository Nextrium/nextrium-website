import { brand } from './index'
import Mark from './Mark'

interface WordmarkProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'dark' | 'light'
  showTagline?: boolean
  className?: string
}

const SIZE_MAP = {
  sm: { mark: 24, name: 16, tagline: 7 },
  md: { mark: 36, name: 22, tagline: 8 },
  lg: { mark: 52, name: 32, tagline: 9 },
}

/** The selected brand's mark, name (with its accent letters) and optional tagline. */
export default function Wordmark({
  size = 'md',
  variant = 'dark',
  showTagline = false,
  className,
}: WordmarkProps) {
  const s = SIZE_MAP[size]
  const c = brand.colors
  const text = variant === 'dark' ? c['--off-white'] : c['--navy']
  const accent = c['--orange']

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: size === 'sm' ? '8px' : '12px' }}>
      <Mark size={s.mark} bodyColor={text} accentColor={accent} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span
          style={{
            fontFamily: "var(--font-exo2, 'Exo 2', sans-serif)",
            fontWeight: 900,
            fontSize: `${s.name}px`,
            letterSpacing: '-0.3px',
            lineHeight: 1,
            color: text,
            whiteSpace: 'nowrap',
          }}
        >
          {brand.wordmark.before}<span style={{ color: accent }}>{brand.wordmark.accent}</span>{brand.wordmark.after}
        </span>
        {showTagline && (
          <span
            style={{
              fontFamily: "var(--font-mono, 'Space Mono', monospace)",
              fontSize: `${s.tagline}px`,
              letterSpacing: '0.16em',
              textTransform: 'uppercase' as const,
              color: c['--grey-mid'],
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
          >
            {brand.tagline}
          </span>
        )}
      </div>
    </div>
  )
}
