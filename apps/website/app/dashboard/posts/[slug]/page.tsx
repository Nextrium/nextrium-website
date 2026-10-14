import { notFound } from 'next/navigation'
import { createServiceClient } from '@nextrium/supabase/server'
import PostEditor from './PostEditor'
import type { Post } from '@nextrium/supabase/database'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  if (slug === 'new') return { title: 'New Post' }
  return { title: `Edit: ${slug}` }
}

export default async function PostEditorPage({ params }: Props) {
  const { slug } = await params
  const supabase  = createServiceClient()
  let post: Post | null = null

  if (slug !== 'new') {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('slug', slug)
      .single()
    if (!data) notFound()
    post = data
  }

  return <PostEditor post={post} />
}