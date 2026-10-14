'use client'

import { useEffect, useRef } from 'react'
import { C, F, tint } from '@/lib/theme'

/** A modal panel: Escape or a click outside closes it, focus moves into it on open. */
export default function Dialog({ title, subtitle, onClose, children, wide = false }: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current() }
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: tint('--navy-deep', 92), backdropFilter: 'blur(16px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-2xl border overflow-hidden flex flex-col`}
        style={{ background: C.depth, borderColor: C.border, maxHeight: '90vh', outline: 'none' }}
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b" style={{ borderColor: C.border }}>
          <div className="min-w-0">
            <p id="dialog-title" style={{ fontFamily: F.display, fontWeight: 600, fontSize: 17, color: C.light }}>{title}</p>
            {subtitle && <p style={{ fontFamily: F.body, fontSize: 12, color: C.mute, marginTop: 3, overflowWrap: 'anywhere' }}>{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ color: C.mute, background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>
            &times;
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
