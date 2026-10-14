import { notFound } from 'next/navigation'
import { createServiceClient } from '@nextrium/supabase/server'
import RoleEditor from './RoleEditor'
import type { Role } from '@nextrium/supabase/database'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  if (slug === 'new') return { title: 'New Role' }
  return { title: `Edit: ${slug}` }
}

export default async function RoleEditorPage({ params }: Props) {
  const { slug }  = await params
  const supabase  = createServiceClient()
  let role: Role | null = null

  if (slug !== 'new') {
    const { data } = await supabase.from('roles').select('*').eq('slug', slug).single()
    if (!data) notFound()
    role = data
  }

  return <RoleEditor role={role} />
}