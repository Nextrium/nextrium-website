import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isCategory } from '@nextrium/contributions-core/constants'
import { buildFollowUpDraft, type FollowUpPrefill } from '@nextrium/contributions-core/thread'
import Header from '@/components/dashboard/Header'
import { PORTAL_CSS } from '@/components/portal/portalStyles'
import { UUID, community, requirePortalStaff } from '@/lib/portal/server'
import { assignableContributors } from '@/lib/portal/tasks'
import PortalTaskEditor from '../PortalTaskEditor'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New portal task' }

export default async function NewPortalTaskPage({ searchParams }: { searchParams: Promise<{ fromContribution?: string }> }) {
  if ('error' in (await requirePortalStaff())) notFound()
  const { fromContribution } = await searchParams

  let followUpPrefill: FollowUpPrefill | null = null
  if (fromContribution && UUID.test(fromContribution)) {
    const db = community()
    const { data: srcSub } = await db.from('contributions')
      .select('id, task_id, contributor_id, title, category').eq('id', fromContribution).maybeSingle()
    if (srcSub) {
      const { data: srcTask } = srcSub.task_id
        ? await db.from('tasks').select('title, category').eq('id', srcSub.task_id).maybeSingle()
        : { data: null }
      followUpPrefill = buildFollowUpDraft({
        originalTaskTitle: srcTask?.title ?? srcSub.title,
        originalTaskCategory: srcTask?.category ?? srcSub.category,
        submissionTitle: srcSub.title,
        contributionId: srcSub.id,
        suggestedAssigneeId: srcSub.contributor_id,
      })
    }
  }

  const contributors = await assignableContributors()
  const initialCategory = followUpPrefill && isCategory(followUpPrefill.category) ? followUpPrefill.category : 'technical'

  return (
    <>
      <style>{PORTAL_CSS}</style>
      <Header title="New portal task" description="Posted to the contributor portal" action={<Link href="/portal/tasks" className="pt-btn ghost">Back to tasks</Link>} />
      <div className="dash-content" style={{ maxWidth: 900 }}>
        {followUpPrefill && (
          <div className="pt-alert info" style={{ marginBottom: 16 }}>
            Follow-up task linked to <strong>{followUpPrefill.sourceTaskTitle}</strong> ({followUpPrefill.sourceSubmissionTitle}). You can edit any field before saving.{' '}
            <Link href={`/portal/reviews/${followUpPrefill.sourceContributionId}`} className="pt-link">View original submission</Link>
          </div>
        )}
        <PortalTaskEditor
          initial={{
            title: followUpPrefill?.title ?? '',
            description: followUpPrefill?.description ?? '',
            category: initialCategory,
            complexity: 'small',
            links: [],
            tags: '',
          }}
          contributors={contributors}
          followUpPrefill={followUpPrefill}
        />
      </div>
    </>
  )
}
