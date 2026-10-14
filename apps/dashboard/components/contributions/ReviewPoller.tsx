'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const INTERVAL_MS = 8_000
const MAX_POLLS = 15 // two minutes, then the member can reload by hand

/** Refreshes the page while an automated review is running, so its result shows up without a reload. */
export default function ReviewPoller() {
  const router = useRouter()
  useEffect(() => {
    let polls = 0
    const id = setInterval(() => {
      polls += 1
      router.refresh()
      if (polls >= MAX_POLLS) clearInterval(id)
    }, INTERVAL_MS)
    return () => clearInterval(id)
  }, [router])
  return null
}
