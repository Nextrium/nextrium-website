import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import BlogClient from './BlogClient'
import { createClient } from '@nextrium/supabase/server'
import type { Post } from '@nextrium/supabase/database'
import { brand } from '@nextrium/brand'
import { orderWithPins } from '@/lib/pins'

export const metadata = {
  title: 'Blog',
  description: 'Editorials, announcements, product updates and research from NexTrium.',
}

async function getPosts(): Promise<{ posts: Post[]; pinnedIds: string[] }> {
  const supabase = await createClient()
  const [{ data, error }, { data: pins }] = await Promise.all([
    supabase
      .from('posts')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false }),
    // This site's pinned posts, in order. If they can't be read, the blog is simply newest first.
    (supabase.from('post_pins') as any).select('post_id, position').eq('site', brand.slug).order('position'),
  ])
  if (error || !data) return { posts: [], pinnedIds: [] }
  const pinnedIds = ((pins ?? []) as { post_id: string }[]).map((p) => p.post_id)
  return { posts: orderWithPins(data, pinnedIds), pinnedIds }
}

export default async function BlogPage() {
  const { posts, pinnedIds } = await getPosts()
  return (
    <>
      <Navbar />
      <BlogClient posts={posts} pinnedIds={pinnedIds} />
      <Footer />
    </>
  )
}