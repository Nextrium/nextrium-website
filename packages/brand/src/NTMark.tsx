interface NTMarkProps {
  size?: number
  bodyColor?: string
  accentColor?: string
  className?: string
}

export default function NTMark({
  size = 48,
  bodyColor = '#F5F6F8',
  accentColor = '#DB6727',
  className,
}: NTMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <rect x="4" y="4" width="16" height="72" rx="4" fill={bodyColor} />
      <polygon points="20,4 36,4 76,68 76,76 60,76 20,12" fill={bodyColor} />
      <rect x="60" y="4" width="16" height="72" rx="4" fill={bodyColor} />
      <rect x="4" y="4" width="72" height="18" rx="4" fill={accentColor} />
      <rect x="32" y="4" width="16" height="36" rx="3" fill={accentColor} />
    </svg>
  )
}
