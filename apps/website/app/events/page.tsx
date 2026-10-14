import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import EventsClient from './EventsClient'
import { createClient } from '@nextrium/supabase/server'
import type { NTEvent } from '@nextrium/supabase/database'

export const metadata = {
  title: 'Events',
  description: 'Hackathons, workshops, and community sessions organised by NexTrium and the Hub.',
}

async function getEvents(): Promise<NTEvent[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_published', true)
    .order('start_date', { ascending: false })
  if (error || !data) return []
  return data
}

export default async function EventsPage() {
  const events = await getEvents()
  return (
    <>
      <Navbar />
      <EventsClient events={events} />
      <Footer />
    </>
  )
}