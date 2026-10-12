'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { INTERVAL_MS, shouldRefresh, type RefreshTrigger } from '@/lib/dashboard/liveRefresh'

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'hidden'])

function isTextField(el: Element | null): el is Field {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type)
  return el instanceof HTMLElement && el.isContentEditable
}

function hasContent(el: Field): boolean {
  if ('value' in el && typeof el.value === 'string') return el.value.trim() !== ''
  return (el.textContent ?? '').trim() !== ''
}

/**
 * Keeps every dashboard page current by re-fetching its server data in place
 * (router.refresh): when you return to the tab, and every minute while it is
 * visible. It never runs while you are typing or have unsaved text in a
 * field, so forms such as the email composer or task editor are never
 * cleared. Mounted once in the dashboard shell, so new pages get it too.
 */
export default function LiveRefresh() {
  const router = useRouter()
  const pathname = usePathname()
  const lastRef = useRef(Date.now())
  const touched = useRef(new Set<Field>())

  // A new page starts clean.
  useEffect(() => {
    touched.current.clear()
    lastRef.current = Date.now()
  }, [pathname])

  useEffect(() => {
    const onInput = (e: Event) => {
      const el = e.target as Element | null
      if (isTextField(el) && !el.closest('[data-live-refresh-ignore]')) touched.current.add(el)
    }

    const editing = () => {
      if (isTextField(document.activeElement)) return true
      if (document.querySelector('[data-live-refresh="pause"]')) return true
      for (const el of touched.current) {
        if (!el.isConnected) touched.current.delete(el)
        else if (hasContent(el)) return true
      }
      return false
    }

    const attempt = (trigger: RefreshTrigger) => {
      const now = Date.now()
      if (!shouldRefresh({
        trigger,
        pathname: window.location.pathname,
        visible: document.visibilityState === 'visible',
        editing: editing(),
        msSinceLast: now - lastRef.current,
      })) return
      lastRef.current = now
      router.refresh()
    }

    const onReturn = () => attempt('return')
    const timer = window.setInterval(() => attempt('timer'), INTERVAL_MS)
    document.addEventListener('input', onInput, true)
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('input', onInput, true)
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
    }
  }, [router])

  return null
}
