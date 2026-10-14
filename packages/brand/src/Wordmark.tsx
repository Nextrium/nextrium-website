import NTMark from './NTMark'

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

const VARIANT_MAP = {
  dark:  { text: '#F5F6F8', body: '#F5F6F8', tag: '#8A9BB0' },
  light: { text: '#0D233D', body: '#0D233D', tag: '#8A9BB0' },
}

export default function Wordmark({
  size = 'md',
  variant = 'dark',
  showTagline = false,
  className,
}: WordmarkProps) {
  const s = SIZE_MAP[size]
  const v = VARIANT_MAP[variant]

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size === 'sm' ? '8px' : '12px',
      }}
    >
      <NTMark size={s.mark} bodyColor={v.body} accentColor="#DB6727" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span
          style={{
            fontFamily: "var(--font-exo2, 'Exo 2', sans-serif)",
            fontWeight: 900,
            fontSize: `${s.name}px`,
            letterSpacing: '-0.3px',
            lineHeight: 1,
            color: v.text,
            whiteSpace: 'nowrap',
          }}
        >
          Nex<span style={{ color: '#DB6727' }}>T</span>rium
        </span>
        {showTagline && (
          <span
            style={{
              fontFamily: "var(--font-mono, 'Space Mono', monospace)",
              fontSize: `${s.tagline}px`,
              letterSpacing: '0.16em',
              textTransform: 'uppercase' as const,
              color: v.tag,
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
          >
            Innovation. Incubation. Impact.
          </span>
        )}
      </div>
    </div>
  )
}