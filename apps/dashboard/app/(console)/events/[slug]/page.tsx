import { notFound } from 'next/navigation'
import { createServiceClient } from '@nextrium/supabase/server'
import EventEditor from './EventEditor'
import type { NTEvent } from '@nextrium/supabase/database'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  if (slug === 'new') return { title: 'New Event' }
  return { title: `Edit: ${slug}` }
}

export default async function EventEditorPage({ params }: Props) {
  const { slug }  = await params
  const supabase  = createServiceClient()
  let event: NTEvent | null = null

  if (slug !== 'new') {
    const { data } = await supabase.from('events').select('*').eq('slug', slug).single()
    if (!data) notFound()
    event = data
  }

  return <EventEditor event={event} />
}