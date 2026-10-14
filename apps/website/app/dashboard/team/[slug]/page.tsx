import { notFound } from 'next/navigation'
import { createServiceClient } from '@nextrium/supabase/server'
import TeamMemberEditor from './TeamMemberEditor'
import type { TeamMember } from '@nextrium/supabase/database'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  if (slug === 'new') return { title: 'Add Team Member' }
  return { title: `Edit: ${slug}` }
}

export default async function TeamMemberEditorPage({ params }: Props) {
  const { slug }  = await params
  const supabase  = createServiceClient()
  let member: TeamMember | null = null

  if (slug !== 'new') {
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('slug', slug)
      .single()
    if (!data) notFound()
    member = data as TeamMember
  }

  return <TeamMemberEditor member={member} />
}