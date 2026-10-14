import { createServiceClient } from '@nextrium/supabase/server'
import Header from '@/components/dashboard/Header'
import ContactClient from './ContactClient'
import type { ContactSubmission } from '@nextrium/supabase/database'

export const metadata = { title: 'Contact' }

async function getSubmissions(): Promise<ContactSubmission[]> {
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('contact_submissions')
    .select('*')
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function ContactPage() {
  const submissions = await getSubmissions()
  return (
    <>
      <Header title="Contact" description="Manage contact form submissions" />
      <div className="dash-content">
        <ContactClient submissions={submissions} />
      </div>
    </>
  )
}