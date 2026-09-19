import { createServiceClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/Header'
import EmailComposeClient from './EmailComposeClient'
import type { Application, TeamMember } from '@/lib/types/database'

export const metadata = { title: 'Send Email' }
export const dynamic = 'force-dynamic'

interface EmailSender {
  id: string
  name: string
  email: string
  is_default: boolean
}

async function getSenders(): Promise<EmailSender[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('email_senders')
    .select('*')
    .order('is_default', { ascending: false })
  return (data ?? []) as EmailSender[]
}

async function getApplicants(): Promise<Application[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('applications')
    .select('*')
    .eq('archived', false)
    .order('created_at', { ascending: false })
  return (data ?? []) as Application[]
}

async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('team_members')
    .select('*')
    .order('sort_order', { ascending: true })
  return (data ?? []) as TeamMember[]
}

export default async function EmailPage() {
  const [senders, applicants, teamMembers] = await Promise.all([
    getSenders(),
    getApplicants(),
    getTeamMembers(),
  ])

  return (
    <>
      <Header title="Send Email" description="Compose and send branded emails to applicants, team members, or a manual list" />
      <div className="dash-content">
        <EmailComposeClient senders={senders} applicants={applicants} teamMembers={teamMembers} />
      </div>
    </>
  )
}