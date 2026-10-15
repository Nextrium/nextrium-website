'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestExtension, retryReview, unclaimTask, type WorkState } from '@/app/actions/work'
import { CLAIM_COOLDOWN_HOURS } from '@/lib/claims'
import { C, F, tint } from '@/lib/theme'
import Dialog from './Dialog'

const IDLE: WorkState = { status: 'idle' }
const small: React.CSSProperties = { fontSize: 11, padding: '7px 14px', borderRadius: 9999, fontFamily: F.body, cursor: 'pointer', whiteSpace: 'nowrap' }

function Feedback({ state }: { state: WorkState }) {
  if (state.status === 'idle') return null
  return (
    <p role={state.status === 'error' ? 'alert' : 'status'} style={{ fontFamily: F.body, fontSize: 12, color: state.status === 'error' ? C.danger : C.teal, lineHeight: 1.5 }}>
      {state.message}
    </p>
  )
}

/** Asks for confirmation, then gives the task back to the board. */
export function UnclaimButton({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(unclaimTask, IDLE)
  const router = useRouter()
  const close = () => { setOpen(false); if (state.status === 'done') router.refresh() }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-danger-quiet" style={{ ...small, border: `1px solid ${tint('--error', 25)}`, background: 'transparent', color: C.mute }}>
        Unclaim
      </button>
      {open && (
        <Dialog title="Unclaim this task?" subtitle={taskTitle} onClose={() => { if (!pending) close() }}>
          <form action={action} className="p-6 flex flex-col gap-5">
            <input type="hidden" name="taskId" value={taskId} />
            <div className="p-4 rounded-xl" style={{ background: tint('--error', 6), border: `1px solid ${tint('--error', 22)}` }}>
              <p style={{ fontFamily: F.body, fontSize: 13, color: C.mist, lineHeight: 1.65 }}>
                Once unclaimed you will not be able to claim this task again for <strong>{CLAIM_COOLDOWN_HOURS} hours</strong>. Anyone else can claim it straight away.
              </p>
            </div>
            <Feedback state={state} />
            <div className="flex gap-3">
              {state.status !== 'done' && (
                <button type="submit" disabled={pending} style={{ ...small, fontSize: 13, padding: '10px 20px', border: `1px solid ${tint('--error', 35)}`, background: tint('--error', 10), color: C.danger, opacity: pending ? 0.7 : 1 }}>
                  {pending ? 'Unclaiming…' : 'Yes, unclaim'}
                </button>
              )}
              <button type="button" onClick={close} className="btn-outline" style={{ fontSize: 13, cursor: 'pointer' }}>
                {state.status === 'done' ? 'Close' : 'Keep task'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  )
}

export function ExtensionButton({ taskId, days }: { taskId: string; days: number }) {
  const [state, action, pending] = useActionState(requestExtension, IDLE)
  const router = useRouter()
  useEffect(() => { if (state.status === 'done') router.refresh() }, [state, router])
  if (state.status === 'done') return <span style={{ fontFamily: F.body, fontSize: 11, color: C.mute, padding: '7px 0' }}>Extension requested</span>
  return (
    <form action={action} className="flex items-center gap-2 flex-wrap">
      <input type="hidden" name="taskId" value={taskId} />
      <button type="submit" disabled={pending} style={{ ...small, border: `1px solid ${tint('--gold-l', 30)}`, background: tint('--gold-l', 8), color: C.gold, opacity: pending ? 0.7 : 1 }}>
        {pending ? 'Requesting…' : `Request +${days}d extension`}
      </button>
      {state.status === 'error' && <Feedback state={state} />}
    </form>
  )
}

export function RetryReviewButton({ contributionId }: { contributionId: string }) {
  const [state, action, pending] = useActionState(retryReview, IDLE)
  const router = useRouter()
  // Refresh shortly after, so the new status replaces this button once the message has been seen.
  useEffect(() => {
    if (state.status !== 'done') return
    const t = setTimeout(() => router.refresh(), 2500)
    return () => clearTimeout(t)
  }, [state, router])
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="contributionId" value={contributionId} />
      {state.status !== 'done' && (
        <button type="submit" disabled={pending} style={{ ...small, border: `1px solid ${tint('--orange', 30)}`, background: tint('--orange', 8), color: C.accent, opacity: pending ? 0.7 : 1, cursor: pending ? 'progress' : 'pointer' }}>
          {pending ? 'Reviewing…' : 'Retry review'}
        </button>
      )}
      <Feedback state={state} />
    </form>
  )
}
