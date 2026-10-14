'use client'

import { useState } from 'react'
import { C, F, tint } from '@/lib/theme'

/** Copies the profile's address (without any query string) to the clipboard. */
export default function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString())
      setCopied('done')
    } catch {
      setCopied('failed')
    }
    setTimeout(() => setCopied('idle'), 2500)
  }

  return (
    <button
      type="button"
      onClick={copy}
      style={{ fontFamily: F.body, fontSize: 12, color: C.accent, background: 'none', border: `1px solid ${tint('--orange', 30)}`, padding: '8px 16px', borderRadius: 9999, cursor: 'pointer' }}
    >
      <span aria-live="polite">{copied === 'done' ? 'Link copied' : copied === 'failed' ? 'Copy failed, use the address bar' : 'Copy profile link'}</span>
    </button>
  )
}
