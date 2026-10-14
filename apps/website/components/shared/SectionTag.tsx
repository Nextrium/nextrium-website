interface SectionTagProps {
  label: string
  className?: string
}

export default function SectionTag({ label, className }: SectionTagProps) {
  return (
    <span className={`section-tag ${className ?? ''}`}>
      {label}
    </span>
  )
}