'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { claimTask, type ClaimState } from '@/app/actions/claim'
import { cooldownMessage, limitMessage } from '@/lib/claims'
import { C, F } from '@/lib/theme'
import IconBadge from '@/components/IconBadge'
import { claimersLabel, oneOfLabel, windowLabel, type SharedInfo } from '@/lib/sharedTasks'

export type ClaimView =
  | { kind: 'signed_out' }
  | { kind: 'not_approved'; registered: boolean }
  | { kind: 'limit'; maxClaims: number }
  | { kind: 'cooldown'; hours: number }
  | { kind: 'can_claim' }
  | { kind: 'mine'; sharedWith?: number }
  | { kind: 'shared_mine'; copyId: string }
  | { kind: 'shared_full' }
  | { kind: 'shared_closed' }

const IDLE: ClaimState = { status: 'idle' }
const text: React.CSSProperties = { fontFamily: F.body, fontSize: 14, color: C.mute, lineHeight: 1.7 }

export default function ClaimPanel({ taskId, title, deadlineDays, view, boardHref = '/tasks', shared = null }: { taskId: string; title: string; deadlineDays: number; view: ClaimView; boardHref?: string; shared?: SharedInfo | null }) {
  const [state, action, claiming] = useActionState(claimTask, IDLE)

  if (state.status === 'claimed') {
    return (
      <section id="claim" className="p-8 rounded-2xl border flex flex-col items-center text-center" style={{ background: C.depth, borderColor: C.border }}>
        <div className="mb-6">
          <IconBadge token="--teal-l" size={64}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke={C.teal} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M4 14l7 7L24 7" />
            </svg>
          </IconBadge>
        </div>
        <h2 style={{ fontFamily: F.display, fontWeight: 600, fontSize: 24, color: C.light, marginBottom: 12 }}>Task claimed</h2>
        <p style={{ ...text, fontSize: 15, marginBottom: 28, maxWidth: 420 }}>
          You have claimed <span style={{ color: C.accent }}>{state.title}</span>.{state.shared ? ' This is your own copy: you submit your work and earn your points individually.' : ''} Go to your dashboard to track your deadline and submit your work.
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/dashboard" className="btn-primary" style={{ fontSize: 13 }}>Go to dashboard</Link>
          <Link href={boardHref} className="btn-outline" style={{ fontSize: 13 }}>Browse more tasks</Link>
        </div>
      </section>
    )
  }

  const signInHref = `/signin?next=${encodeURIComponent(`/tasks/${taskId}`)}`

  return (
    <section id="claim" aria-label="Claim this task" className="p-6 rounded-2xl border" style={{ background: C.depth, borderColor: C.border }}>
      {state.status === 'error' && (
        <p role="alert" style={{ fontFamily: F.body, fontSize: 13, color: C.danger, marginBottom: 16 }}>{state.message}</p>
      )}

      {view.kind === 'signed_out' && (
        <div className="flex flex-col gap-3">
          <p style={text}>Sign in to claim this task and start earning points on the public leaderboard.</p>
          <div className="flex gap-3 flex-wrap">
            <Link href={signInHref} className="btn-primary" style={{ fontSize: 13 }}>Sign in to claim</Link>
            <Link href="/signin" className="btn-outline" style={{ fontSize: 13 }}>Register to contribute</Link>
          </div>
        </div>
      )}

      {view.kind === 'not_approved' && (
        <div className="flex flex-col gap-3">
          <p style={text}>
            {view.registered
              ? 'Your contributor application needs to be approved before you can claim tasks.'
              : 'Complete your contributor application to start claiming tasks. The core team reviews it before activation.'}
          </p>
          <div>
            <Link href={view.registered ? '/dashboard' : '/register'} className="btn-primary" style={{ fontSize: 13 }}>
              {view.registered ? 'Check your application' : 'Complete your application'}
            </Link>
          </div>
        </div>
      )}

      {view.kind === 'limit' && (
        <div className="flex flex-col gap-3">
          <p style={text}>{limitMessage(view.maxClaims)}</p>
          <div><Link href="/dashboard" className="btn-primary" style={{ fontSize: 13 }}>Go to dashboard</Link></div>
        </div>
      )}

      {view.kind === 'cooldown' && (
        <div className="flex flex-col gap-3">
          <p style={text}>{cooldownMessage(view.hours)}</p>
          <div><Link href={boardHref} className="btn-outline" style={{ fontSize: 13 }}>Back to tasks</Link></div>
        </div>
      )}

      {shared && view.kind !== 'shared_closed' && (
        <p style={{ ...text, color: C.light, marginBottom: 12 }} data-shared-info>
          Open to several contributors · {windowLabel(shared.closesAt)} · {claimersLabel(shared)}
        </p>
      )}

      {view.kind === 'shared_closed' && (
        <div className="flex flex-col gap-3">
          <p style={text}>Claims for this task have closed. Everyone who claimed it in time is working on their own copy.</p>
          <div><Link href={boardHref} className="btn-outline" style={{ fontSize: 13 }}>Back to tasks</Link></div>
        </div>
      )}

      {view.kind === 'shared_full' && (
        <div className="flex flex-col gap-3">
          <p style={text}>All places on this task have been taken.</p>
          <div><Link href={boardHref} className="btn-outline" style={{ fontSize: 13 }}>Back to tasks</Link></div>
        </div>
      )}

      {view.kind === 'shared_mine' && (
        <div className="flex flex-col gap-3">
          <p style={text}>You have claimed this task. Your own copy is on your dashboard.</p>
          <div><Link href={`/dashboard/tasks/${view.copyId}`} className="btn-primary" style={{ fontSize: 13 }}>Open my copy</Link></div>
        </div>
      )}

      {view.kind === 'mine' && (
        <div className="flex flex-col gap-3">
          {view.sharedWith !== undefined && oneOfLabel(view.sharedWith) && <p style={{ ...text, color: C.light }} data-one-of>{oneOfLabel(view.sharedWith)}</p>}
          <p style={text}>You are working on this task. Track your deadline and submit your work from your dashboard.</p>
          <div><Link href={`/dashboard?tab=tasks#task-${taskId}`} className="btn-primary" style={{ fontSize: 13 }}>Go to my tasks</Link></div>
        </div>
      )}

      {view.kind === 'can_claim' && (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="taskId" value={taskId} />
          <p style={text}>
            {shared
              ? `Claiming gives you your own copy of this task, and your ${deadlineDays}-day deadline starts immediately. You submit and earn points individually.`
              : `Claiming this task starts your ${deadlineDays}-day deadline immediately. Submit your work from your dashboard before the deadline.`}
          </p>
          <div className="flex gap-3 flex-wrap">
            <button type="submit" disabled={claiming} className="btn-primary" style={{ fontSize: 13, opacity: claiming ? 0.7 : 1, cursor: 'pointer' }} aria-label={`Claim ${title}`}>
              {claiming ? 'Claiming...' : 'Claim this task'}
            </button>
            <Link href={boardHref} className="btn-outline" style={{ fontSize: 13 }}>Back to tasks</Link>
          </div>
        </form>
      )}
    </section>
  )
}
