import React from 'react'
import Link from 'next/link'

interface CTABoxProps {
  href: string
  label: string
  variant?: 'dark' | 'light'
  external?: boolean
  fullWidth?: boolean
  className?: string
}

export default function CTABox({
  href,
  label,
  variant = 'dark',
  external = false,
  fullWidth = false,
  className,
}: CTABoxProps) {
  const isDark = variant === 'dark'

  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '16px 24px',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'var(--grey-light)'}`,
    color: isDark ? 'var(--white)' : 'var(--navy-deep)',
    fontSize: '14px',
    fontFamily: "var(--font-dm, 'DM Sans', sans-serif)",
    fontWeight: 400,
    textDecoration: 'none',
    transition: 'border-color var(--transition-base), background var(--transition-base)',
    width: fullWidth ? '100%' : undefined,
    maxWidth: fullWidth ? '100%' : '340px',
    cursor: 'pointer',
  }

  const content = (
    <>
      <span>{label}</span>
      <span aria-hidden="true">→</span>
    </>
  )

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={style}
        className={className}
      >
        {content}
      </a>
    )
  }

  return (
    <Link href={href} style={style} className={className}>
      {content}
    </Link>
  )
}