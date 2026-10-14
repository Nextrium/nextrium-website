import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import BlogClient from './BlogClient'
import { createClient } from '@nextrium/supabase/server'
import type { Post } from '@nextrium/supabase/database'

export const metadata = {
  title: 'Blog',
  description: 'Editorials, announcements, product updates and research from NexTrium.',
}

async function getPosts(): Promise<Post[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
  if (error || !data) return []
  return data
}

export default async function BlogPage() {
  const posts = await getPosts()
  return (
    <>
      <Navbar />
      <BlogClient posts={posts} />
      <Footer />
    </>
  )
}