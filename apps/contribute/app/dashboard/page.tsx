import Link from 'next/link'
import { COMPLEXITY_LABELS, type Complexity } from '@nextrium/contributions-core/constants'
import { getActiveContributor } from '@/lib/portal'
import { getMyDashboard, latestByTask, type MyProfile, type MySubmission, type MyTask } from '@/lib/contributorData'
import { canRequestExtension, extensionDays, timeRemaining } from '@/lib/deadline'
import { publicName } from '@/lib/ranking'
import { submissionState } from '@/lib/submissionView'
import { AVAILABILITY } from '@/lib/registration'
import { C, F, categoryToken, tint } from '@/lib/theme'
import { CategoryBadge, ComplexityBadge } from '@/components/Badges'
import StatusBadge from '@/components/dashboard/StatusBadge'
import SubmitLauncher from '@/components/dashboard/SubmitLauncher'
import type { SubmitTarget } from '@/components/dashboard/SubmitWorkDialog'
import { ExtensionButton, RetryReviewButton, UnclaimButton } from '@/components/dashboard/TaskActions'
import ProfileEditForm from '@/components/dashboard/ProfileEditForm'

export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'My tasks' },
  { key: 'submissions', label: 'Submissions' },
  { key: 'profile', label: 'Profile' },
] as const
type Tab = (typeof TABS)[number]['key']

const heading: React.CSSProperties = { fontFamily: F.display, fontWeight: 600, fontSize: 15, color: C.light }
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''

/** What the contributor can do next with each running task. */
function taskTarget(task: MyTask, latest: MySubmission | undefined): { kind: 'submit' | 'resubmit' | 'waiting'; target?: SubmitTarget; retryId?: string } {
  if (!latest) return { kind: 'submit', target: { taskId: task.id, taskTitle: task.title } }
  const state = submissionState(latest)
  if (state.canResubmit) {
    return { kind: 'resubmit', target: { taskId: task.id, taskTitle: task.title, title: latest.title, description: latest.description ?? '', evidenceUrl: latest.evidence_url ?? '' } }
  }
  return { kind: 'waiting', retryId: state.canRetryReview ? latest.id : undefined }
}

function pointsLabel(s: MySubmission): { value: number; note: string } {
  return s.status === 'verified' ? { value: s.final_points ?? s.base_points, note: 'pts' } : { value: s.base_points, note: 'est. pts' }
}

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const active = await getActiveContributor()
  if (!active) return null
  const { tab: rawTab } = await searchParams
  const tab: Tab = TABS.some((t) => t.key === rawTab) ? (rawTab as Tab) : 'overview'

  const { me, submissions, tasks } = await getMyDashboard(active.id)
  const latest = latestByTask(submissions)
  const plans = new Map(tasks.map((t) => [t.id, taskTarget(t, latest.get(t.id))]))
  const submitTargets = tasks.flatMap((t) => (plans.get(t.id)?.kind === 'submit' ? [plans.get(t.id)!.target!] : []))
  const running = new Set(tasks.map((t) => t.id))
  const pending = submissions.filter((s) => ['submitted', 'under_review', 'ai_approved'].includes(s.status)).length
  const token = categoryToken(me.categories[0])
  const name = publicName(me)

  const stats = [
    { label: 'Total points', value: me.total_points.toLocaleString('en-GB'), color: `var(${token})` },
    { label: 'Verified contributions', value: me.verified_contributions, color: C.teal },
    { label: 'Pending review', value: pending, color: C.gold },
    { label: 'All submissions', value: submissions.length, color: C.mute },
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-14 py-12 lg:py-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-10 flex-wrap">
        <div className="flex items-center gap-5 min-w-0">
          <div className="flex items-center justify-center rounded-full flex-shrink-0" aria-hidden="true" style={{ width: 56, height: 56, background: tint(token, 10), border: `1px solid ${tint(token, 22)}` }}>
            <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 22, color: `var(${token})` }}>{name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <h1 style={{ fontFamily: F.display, fontWeight: 600, fontSize: 'clamp(20px,3vw,32px)', letterSpacing: '-0.02em', color: C.light, lineHeight: 1.1, overflowWrap: 'anywhere' }}>{name}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {me.categories.map((c) => <CategoryBadge key={c} category={c} size="md" />)}
              <StatusBadge tone="good">Active</StatusBadge>
            </div>
          </div>
        </div>
        <Link href={`/contributors/${me.id}`} className="btn-outline" style={{ fontSize: 12, padding: '9px 18px' }}>View public profile</Link>
      </div>

      {/* Stats */}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col-reverse gap-2 p-5 rounded-2xl border" style={{ background: C.depth, borderColor: C.border }}>
            <dt style={{ fontFamily: F.body, fontSize: 11, color: C.mute, lineHeight: 1.4 }}>{s.label}</dt>
            <dd style={{ fontFamily: F.display, fontWeight: 600, fontSize: 26, letterSpacing: '-0.02em', color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</dd>
          </div>
        ))}
      </dl>

      {/* Tabs */}
      <nav aria-label="Dashboard sections" className="flex border-b mb-8 overflow-x-auto" style={{ borderColor: C.border }}>
        {TABS.map((t) => {
          const on = t.key === tab
          return (
            <Link
              key={t.key}
              href={t.key === 'overview' ? '/dashboard' : `/dashboard?tab=${t.key}`}
              aria-current={on ? 'page' : undefined}
              style={{ padding: '12px 20px', fontFamily: F.body, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', color: on ? C.accent : C.mute, borderBottom: `2px solid ${on ? C.core : 'transparent'}`, textDecoration: 'none' }}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>

      {tab === 'overview' && <Overview submissions={submissions} submitTargets={submitTargets} running={running} />}
      {tab === 'tasks' && <MyTasks me={me} tasks={tasks} plans={plans} />}
      {tab === 'submissions' && <Submissions submissions={submissions} submitTargets={submitTargets} running={running} />}
      {tab === 'profile' && <Profile me={me} />}
    </div>
  )
}

function SubmissionRow({ s, running, compact = false }: { s: MySubmission; running: Set<string>; compact?: boolean }) {
  const raw = submissionState(s)
  // Resubmitting needs the task: an old submission for a task given back to the board cannot be resubmitted.
  const held = !!s.task_id && running.has(s.task_id)
  const state = raw.canResubmit && !held ? { ...raw, canResubmit: false, hint: 'Claim this task again to resubmit.' } : raw
  const pts = pointsLabel(s)
  return (
    <li className="flex flex-col rounded-xl border" style={{ background: C.depth, borderColor: C.border }}>
      <Link href={`/dashboard/submissions/${s.id}`} className="flex items-center gap-4 p-4 sm:p-5" style={{ textDecoration: 'none' }}>
        <div className="flex-1 min-w-0">
          <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: compact ? 13 : 14, color: C.light, marginBottom: 4, overflowWrap: 'anywhere' }}>{s.title}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontFamily: F.body, fontSize: 10, color: `var(${categoryToken(s.category)})`, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.category}</span>
            <span aria-hidden="true" style={{ color: C.dim }}>·</span>
            <span style={{ fontFamily: F.body, fontSize: 10, color: C.mute }}>{COMPLEXITY_LABELS[s.complexity as Complexity] ?? s.complexity}</span>
            {!compact && <><span aria-hidden="true" style={{ color: C.dim }}>·</span><span style={{ fontFamily: F.body, fontSize: 10, color: C.mute }}>{fmtDate(s.updated_at ?? s.created_at)}</span></>}
            {(s.submission_count ?? 1) > 1 && <><span aria-hidden="true" style={{ color: C.dim }}>·</span><span style={{ fontFamily: F.body, fontSize: 10, color: C.dim }}>Submission {s.submission_count}</span></>}
          </div>
        </div>
        <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
        <div className="text-right flex-shrink-0">
          <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: 16, color: `var(${categoryToken(s.category)})`, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{pts.value}</div>
          <div style={{ fontFamily: F.body, fontSize: 9, color: C.mute, marginTop: 2 }}>{pts.note}</div>
        </div>
      </Link>
      {!compact && (state.canResubmit || state.canRetryReview || state.tone === 'progress') && (
        <div className="px-5 pb-4 flex items-center justify-between gap-3 border-t pt-3 flex-wrap" style={{ borderColor: C.border }}>
          <p style={{ fontFamily: F.body, fontSize: 11, color: C.mute, lineHeight: 1.5, flex: 1, minWidth: 180 }}>{state.hint}</p>
          {state.canRetryReview && <RetryReviewButton contributionId={s.id} />}
          {state.canResubmit && (
            <Link href={`/dashboard?tab=tasks#task-${s.task_id}`} style={{ padding: '6px 16px', borderRadius: 9999, border: `1px solid ${tint('--orange', 30)}`, background: tint('--orange', 8), color: C.accent, fontFamily: F.body, fontSize: 11, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Resubmit
            </Link>
          )}
        </div>
      )}
    </li>
  )
}

function Overview({ submissions, submitTargets, running }: { submissions: MySubmission[]; submitTargets: SubmitTarget[]; running: Set<string> }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <SubmitLauncher
          targets={submitTargets}
          runningCount={running.size}
          className="lift flex flex-col gap-3 p-6 rounded-2xl border text-left"
          style={{ background: `linear-gradient(135deg, ${C.depth}, ${tint('--orange', 8)})`, borderColor: C.core }}
          label={
            <>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: tint('--orange', 15), border: `1px solid ${tint('--orange', 30)}` }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M9 3v12M3 9h12" /></svg>
              </span>
              <span style={heading}>Submit your work</span>
              <span style={{ fontFamily: F.body, fontWeight: 300, fontSize: 12, color: C.mute, lineHeight: 1.6 }}>
                Send finished work on a claimed task for automated review and core team verification.
              </span>
            </>
          }
        />
        <Link href="/dashboard/tasks" className="lift flex flex-col gap-3 p-6 rounded-2xl border" style={{ background: C.depth, borderColor: C.border, textDecoration: 'none' }}>
          <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: tint('--orange', 10), border: `1px solid ${tint('--orange', 20)}` }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={C.mute} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><rect x="2" y="2" width="14" height="14" rx="2" /><path d="M6 7h6M6 11h4" /></svg>
          </span>
          <span style={heading}>Browse open tasks</span>
          <span style={{ fontFamily: F.body, fontWeight: 300, fontSize: 12, color: C.mute, lineHeight: 1.6 }}>Find work that matches your skills and availability.</span>
        </Link>
      </div>

      {submissions.length > 0 && (
        <section>
          <h2 className="mb-4" style={heading}>Recent submissions</h2>
          <ul className="flex flex-col gap-3">
            {submissions.slice(0, 3).map((s) => <SubmissionRow key={s.id} s={s} running={running} compact />)}
          </ul>
          {submissions.length > 3 && (
            <Link href="/dashboard?tab=submissions" className="inline-block mt-3" style={{ fontFamily: F.body, fontSize: 12, color: C.accent, textDecoration: 'none' }}>
              View all {submissions.length} submissions
            </Link>
          )}
        </section>
      )}
    </div>
  )
}

function MyTasks({ me, tasks, plans }: { me: MyProfile; tasks: MyTask[]; plans: Map<string, ReturnType<typeof taskTarget>> }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 rounded-2xl border text-center" style={{ background: C.depth, borderColor: C.border }}>
        <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 16, color: C.light, marginBottom: 6 }}>No active tasks</p>
        <p style={{ fontFamily: F.body, fontSize: 13, color: C.mute, marginBottom: 20 }}>Browse the open task board and claim a task to get started.</p>
        <Link href="/dashboard/tasks" className="btn-primary" style={{ fontSize: 13 }}>Browse open tasks</Link>
      </div>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4 gap-4">
        <h2 style={heading}>Active claims</h2>
        <span style={{ fontFamily: F.body, fontSize: 11, color: C.mute }}>{tasks.length} of {me.max_claims} slots used</span>
      </div>
      <ul className="flex flex-col gap-4">
        {tasks.map((task) => {
          const time = timeRemaining(task)
          const plan = plans.get(task.id)!
          const token = categoryToken(task.category)
          const urgency = time.urgency === 'overdue' ? '--error' : time.urgency === 'urgent' ? '--gold-l' : '--orange-w'
          return (
            <li key={task.id} id={`task-${task.id}`} className="rounded-2xl border overflow-hidden" style={{ background: C.depth, borderColor: C.border, scrollMarginTop: 80 }}>
              <div style={{ height: 3, background: C.border }} aria-hidden="true">
                <div style={{ height: '100%', width: `${Math.min(100, Math.max(2, time.used * 100))}%`, background: `linear-gradient(90deg, var(--orange), var(${urgency}))` }} />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <CategoryBadge category={task.category} />
                      <ComplexityBadge complexity={task.complexity} />
                      {task.extension_granted && <StatusBadge tone="pending">Extended</StatusBadge>}
                      {task.extension_requested_at && !task.extension_granted && <StatusBadge tone="progress">Extension requested</StatusBadge>}
                    </div>
                    <Link href={`/dashboard/tasks/${task.id}`} style={{ fontFamily: F.display, fontWeight: 600, fontSize: 15, color: C.light, lineHeight: 1.3, textDecoration: 'none', overflowWrap: 'anywhere' }}>
                      {task.title}
                    </Link>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: 16, color: `var(${token})`, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{task.point_range_min}–{task.point_range_max}</div>
                    <div style={{ fontFamily: F.body, fontSize: 9, color: C.mute, marginTop: 2 }}>pts</div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 p-3 rounded-xl mb-4 flex-wrap" style={{ background: tint(urgency, 8), border: `1px solid ${tint(urgency, 25)}` }}>
                  <span className="flex items-center gap-2" style={{ fontFamily: F.body, fontSize: 12, fontWeight: 500, color: `var(${urgency})` }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="7" cy="7" r="6" /><path d="M7 4v3l2 2" /></svg>
                    {time.label}
                  </span>
                  {time.deadline && <span style={{ fontFamily: F.body, fontSize: 10, color: C.mute }}>Due {fmtDate(time.deadline.toISOString())}</span>}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {plan.kind !== 'waiting' && plan.target && (
                    <SubmitLauncher
                      targets={[plan.target]}
                      initial={plan.kind === 'resubmit' ? plan.target : null}
                      label={plan.kind === 'resubmit' ? 'Resubmit work' : 'Submit work'}
                      className="btn-primary"
                      style={{ fontSize: 11, padding: '7px 14px' }}
                    />
                  )}
                  {plan.kind === 'waiting' && (
                    <span style={{ fontFamily: F.body, fontSize: 11, color: C.mute, padding: '7px 0' }}>Submitted, waiting for review</span>
                  )}
                  {plan.retryId && <RetryReviewButton contributionId={plan.retryId} />}
                  {canRequestExtension(task) && <ExtensionButton taskId={task.id} days={extensionDays(task.complexity)} />}
                  {plan.kind !== 'waiting' && <UnclaimButton taskId={task.id} taskTitle={task.title} />}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Submissions({ submissions, submitTargets, running }: { submissions: MySubmission[]; submitTargets: SubmitTarget[]; running: Set<string> }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-2 gap-4">
        <p style={{ fontFamily: F.body, fontSize: 13, color: C.mute }}>{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</p>
        <SubmitLauncher targets={submitTargets} runningCount={running.size} label="New submission" className="btn-primary" style={{ fontSize: 12, padding: '8px 18px' }} />
      </div>
      {submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 rounded-2xl border text-center" style={{ background: C.depth, borderColor: C.border }}>
          <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 16, color: C.light, marginBottom: 6 }}>No submissions yet</p>
          <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 13, color: C.mute }}>Claim a task, then submit your work to start earning points.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">{submissions.map((s) => <SubmissionRow key={s.id} s={s} running={running} />)}</ul>
      )}
    </section>
  )
}

function Profile({ me }: { me: MyProfile }) {
  const availability = AVAILABILITY.find((a) => a.value === me.availability_hours_per_week)?.label
  const fields = [
    ['Full name', me.name],
    ['Email', me.email],
    ['Categories', me.categories.join(', ')],
    ['Contributor type', me.contributor_type],
    ['Team name', me.contributor_type === 'team' ? me.team_name : null],
    ['Location', me.location],
    ['Timezone', me.timezone],
    ['Availability', availability ?? (me.availability_hours_per_week ? `${me.availability_hours_per_week} hrs/week` : null)],
    ['GitHub', me.github_handle],
    ['Twitter / X', me.twitter_handle],
    ['LinkedIn', me.linkedin_url],
    ['Portfolio', me.portfolio_url],
    ['Skills', (me.skills ?? []).join(', ')],
    ['Bio', me.bio],
    ['Wallet address', me.wallet_address],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <section className="flex flex-col gap-3">
      <dl className="flex flex-col gap-3">
        {fields.map(([label, value]) => (
          <div key={label} className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 p-4 rounded-xl border items-start" style={{ background: C.depth, borderColor: C.border }}>
            <dt style={{ fontFamily: F.body, fontSize: 12, color: C.mute }}>{label}</dt>
            <dd className="sm:col-span-2" style={{ fontFamily: F.body, fontSize: 13, color: C.light, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{value}</dd>
          </div>
        ))}
      </dl>
      <ProfileEditForm me={me} />
    </section>
  )
}
