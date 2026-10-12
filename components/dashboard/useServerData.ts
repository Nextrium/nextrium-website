'use client'

import { useEffect, useRef } from 'react'

/**
 * For a client component that copies server data into local state: when the
 * page's data is re-fetched (a soft refresh), replace the local copy with the
 * fresh server data. Ordinary re-renders don't trigger it; only new server data.
 */
export function useServerData<T>(serverValue: T, apply: (value: T) => void): void {
  const last = useRef(serverValue)
  useEffect(() => {
    if (last.current === serverValue) return
    last.current = serverValue
    apply(serverValue)
  }, [serverValue]) // eslint-disable-line react-hooks/exhaustive-deps
}
