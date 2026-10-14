import { notFound } from 'next/navigation'
import { createServiceClient } from '@nextrium/supabase/server'
import CommunityProjectEditor from './CommunityProjectEditor'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  if (slug === 'new') return { title: 'New Community Project' }
  return { title: `Edit: ${slug}` }
}

export default async function CommunityProjectEditorPage({ params }: Props) {
  const { slug } = await params
  const supabase  = createServiceClient()
  let project     = null

  if (slug !== 'new') {
    const { data } = await supabase
      .from('community_projects')
      .select('*')
      .eq('slug', slug)
      .single()
    if (!data) notFound()
    project = data
  }

  return <CommunityProjectEditor project={project} />
}