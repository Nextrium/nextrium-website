'use client'

import { useEffect } from 'react'
import { syncMyDiscordAccess } from '@/app/dashboard/people/actions'

const STORAGE_KEY = 'nextrium-discord-sync-at'
const MIN_INTERVAL_MS = 10 * 60 * 1000

// Quietly re-checks the signed-in person's Discord access when the dashboard
// opens, at most once every 10 minutes per browser. It only does real work
// for people who have connected Discord and are still waiting on something
// (for example finishing verification in the server).
export default function DiscordAccessSync() {
  useEffect(() => {
    try {
      const last = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0)
      if (Date.now() - last < MIN_INTERVAL_MS) return
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()))
    } catch {
      // Storage unavailable: skip rather than re-check on every page.
      return
    }
    syncMyDiscordAccess().catch(() => {})
  }, [])

  return null
}
