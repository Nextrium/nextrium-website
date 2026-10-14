'use client'

import { useMemo, useState } from 'react'

/**
 * Shared dashboard search engine. Every dashboard page wires this same hook
 * into its own local dataset — search is always scoped to whatever the
 * current page already has loaded (e.g. Applications only searches
 * applications), never a cross-page result set. One implementation, reused
 * everywhere, rather than each page hand-rolling its own filter logic.
 */
export function useDashboardSearch<T>(items: T[], getSearchableText: (item: T) => (string | null | undefined)[]) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return items

    return items.filter((item) =>
      getSearchableText(item).some((field) => field?.toLowerCase().includes(trimmed))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query])

  return { query, setQuery, results }
}
