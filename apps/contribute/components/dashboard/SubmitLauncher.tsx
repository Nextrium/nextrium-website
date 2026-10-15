'use client'

import { useState } from 'react'
import SubmitWorkDialog, { type SubmitTarget } from './SubmitWorkDialog'

/** A button that opens the submit dialog, for a given task (or a choice of the contributor's tasks). */
export default function SubmitLauncher({ targets, initial = null, runningCount = 0, label, className, style }: {
  targets: SubmitTarget[]
  /** Running tasks the contributor holds, including ones already submitted. */
  runningCount?: number
  initial?: SubmitTarget | null
  label: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={{ cursor: 'pointer', ...style }}>
        {label}
      </button>
      {open && <SubmitWorkDialog targets={targets} initial={initial} runningCount={runningCount} onClose={() => setOpen(false)} />}
    </>
  )
}
