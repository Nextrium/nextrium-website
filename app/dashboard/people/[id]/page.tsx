import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/Header'

export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<string, string> = {
  admin:     'Admin',
  content:   'Content',
  community: 'Community',
  moderator: 'Moderator',
  member:    'Team Member',
}

const SOCIAL_LABELS: Record<string, string> = {
  twitter:  'Twitter / X',
  linkedin: 'LinkedIn',
  github:   'GitHub',
  discord:  'Discord',
  website:  'Website',
}

interface ProfileData {
  userId:          string
  email:           string
  role:            string
  bio:             string | null
  socialHandles:   Record<string, string>
  discordUsername: string | null
  discordLinked:   boolean
  trackName:       string | null
  createdAt:       string
}

async function getProfile(userId: string): Promise<ProfileData | null> {
  const supabase = createServiceClient()

  const { data: dashboardUser } = await (supabase.from('dashboard_users') as any)
    .select('user_id, role, bio, social_handles, discord_username, discord_linked_at, staff_track_id, created_at, archived')
    .eq('user_id', userId)
    .maybeSingle()

  if (!dashboardUser || dashboardUser.archived) return null

  const [{ data: authUser }, trackResult] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    dashboardUser.staff_track_id
      ? (supabase.from('staff_tracks') as any).select('name').eq('id', dashboardUser.staff_track_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return {
    userId:          dashboardUser.user_id,
    email:           authUser?.user?.email ?? 'Unknown',
    role:            dashboardUser.role,
    bio:             dashboardUser.bio,
    socialHandles:   dashboardUser.social_handles ?? {},
    discordUsername: dashboardUser.discord_username,
    discordLinked:   !!dashboardUser.discord_linked_at,
    trackName:       trackResult?.data?.name ?? null,
    createdAt:       dashboardUser.created_at,
  }
}

export default async function PersonProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile(id)
  if (!profile) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isOwnProfile = user?.id === profile.userId

  const displayName = profile.email.split('@')[0]
  const handles = Object.entries(profile.socialHandles).filter(([, v]) => !!v)

  return (
    <>
      <style>{`
        .profile-wrap { max-width: 640px; }
        .profile-card { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 28px; }
        .profile-top { display: flex; align-items: center; gap: 18px; margin-bottom: 20px; }
        .profile-avatar { width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; background: rgba(219,103,39,0.12); color: var(--orange); font-family: var(--font-mono); font-size: 20px; font-weight: 700; border-radius: 2px; flex-shrink: 0; }
        .profile-name { font-family: var(--font-exo2); font-weight: 700; font-size: 20px; color: var(--white); text-transform: capitalize; }
        .profile-email { font-size: 13px; color: var(--grey-mid); margin-top: 2px; }
        .profile-meta-row { display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
        .profile-pill { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 10px; border: 1px solid rgba(219,103,39,0.3); color: var(--orange); }
        .profile-pill.track { border-color: rgba(255,255,255,0.15); color: var(--grey-mid); }
        .profile-section { margin-top: 22px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); }
        .profile-section-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); margin-bottom: 10px; }
        .profile-bio { font-size: 13px; color: var(--off-white); line-height: 1.6; }
        .profile-handles { display: flex; flex-direction: column; gap: 8px; }
        .profile-handle-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
        .profile-handle-label { color: var(--grey-mid); }
        .profile-handle-value { color: var(--off-white); }
        .profile-empty { font-size: 13px; color: var(--grey-dark); }
        .profile-edit-link { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--orange); text-decoration: none; border: 1px solid rgba(219,103,39,0.3); padding: 8px 14px; }
        .profile-edit-link:hover { background: rgba(219,103,39,0.08); }
      `}</style>

      <Header
        title={displayName}
        description={ROLE_LABELS[profile.role] ?? profile.role}
        action={isOwnProfile ? <Link href="/dashboard/people/me" className="profile-edit-link">Edit my profile</Link> : undefined}
      />
      <div className="dash-content">
        <div className="profile-wrap">
          <div className="profile-card">
            <div className="profile-top">
              <div className="profile-avatar">{displayName.slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="profile-name">{displayName}</div>
                <div className="profile-email">{profile.email}</div>
                <div className="profile-meta-row">
                  <span className="profile-pill">{ROLE_LABELS[profile.role] ?? profile.role}</span>
                  {profile.trackName && <span className="profile-pill track">{profile.trackName}</span>}
                  {profile.discordLinked && <span className="profile-pill track">🎮 {profile.discordUsername}</span>}
                </div>
              </div>
            </div>

            <div className="profile-section">
              <div className="profile-section-title">Bio</div>
              {profile.bio ? <div className="profile-bio">{profile.bio}</div> : <div className="profile-empty">No bio yet.</div>}
            </div>

            <div className="profile-section">
              <div className="profile-section-title">Social handles</div>
              {handles.length > 0 ? (
                <div className="profile-handles">
                  {handles.map(([key, value]) => (
                    <div key={key} className="profile-handle-row">
                      <span className="profile-handle-label">{SOCIAL_LABELS[key] ?? key}</span>
                      <span className="profile-handle-value">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="profile-empty">No social handles added yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
