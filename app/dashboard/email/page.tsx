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

export interface ScreeningSendInfo {
  email_sent: boolean
  recommendation: string | null
  last_emailed_recommendation: string | null
}

// Keyed by application_id — lets the composer show "already sent this
// result" without re-deriving screening state itself, and without pulling
// the full agent_screening_results row (full_result alone can be large).
async function getScreeningSendInfo(): Promise<Record<string, ScreeningSendInfo>> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('agent_screening_results')
    .select('application_id, email_sent, recommendation, last_emailed_recommendation')
    .order('screened_at', { ascending: false })

  const map: Record<string, ScreeningSendInfo> = {}
  data?.forEach((row: any) => {
    if (!map[row.application_id]) {
      map[row.application_id] = {
        email_sent: row.email_sent,
        recommendation: row.recommendation,
        last_emailed_recommendation: row.last_emailed_recommendation,
      }
    }
  })
  return map
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
  const [senders, applicants, teamMembers, screeningSendInfo] = await Promise.all([
    getSenders(),
    getApplicants(),
    getTeamMembers(),
    getScreeningSendInfo(),
  ])

  return (
    <>
      <Header title="Send Email" description="Compose and send branded emails to applicants, team members, or a manual list" />
      <div className="dash-content">
        <EmailComposeClient senders={senders} applicants={applicants} teamMembers={teamMembers} screeningSendInfo={screeningSendInfo} />
      </div>
    </>
  )
}