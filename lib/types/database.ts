export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          role_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          role_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          role_id?: string | null
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          slug: string
          name: string
          tagline: string
          description: string | null
          status: 'in_development' | 'beta' | 'live' | 'sunset'
          category: string[]
          tech_stack: string[]
          body_color: string
          website_url: string | null
          github_url: string | null
          cover_image_url: string | null
          is_featured: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          tagline: string
          description?: string | null
          status?: 'in_development' | 'beta' | 'live' | 'sunset'
          category?: string[]
          tech_stack?: string[]
          body_color?: string
          website_url?: string | null
          github_url?: string | null
          cover_image_url?: string | null
          is_featured?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          slug?: string
          name?: string
          tagline?: string
          description?: string | null
          status?: 'in_development' | 'beta' | 'live' | 'sunset'
          category?: string[]
          tech_stack?: string[]
          body_color?: string
          website_url?: string | null
          github_url?: string | null
          cover_image_url?: string | null
          is_featured?: boolean
          sort_order?: number
          updated_at?: string
        }
      }
      services: {
        Row: {
          id: string
          slug: string
          name: string
          description: string
          deliverables: string[]
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          description: string
          deliverables?: string[]
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          slug?: string
          name?: string
          description?: string
          deliverables?: string[]
          sort_order?: number
          is_active?: boolean
          updated_at?: string
        }
      }
      events: {
        Row: {
          id: string
          slug: string
          title: string
          description: string
          event_type: 'hackathon' | 'workshop' | 'summit' | 'community' | 'other'
          status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
          start_date: string
          end_date: string | null
          location: string
          is_hub_event: boolean
          cover_color: string
          cover_image_url: string | null
          youtube_url: string | null
          social_links: string[] | null
          registration_url: string | null
          gallery: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          description: string
          event_type?: 'hackathon' | 'workshop' | 'summit' | 'community' | 'other'
          status?: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
          start_date: string
          end_date?: string | null
          location: string
          is_hub_event?: boolean
          cover_color?: string
          cover_image_url?: string | null
          youtube_url?: string | null
          social_links?: string[] | null
          registration_url?: string | null
          gallery?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          slug?: string
          title?: string
          description?: string
          event_type?: 'hackathon' | 'workshop' | 'summit' | 'community' | 'other'
          status?: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
          start_date?: string
          end_date?: string | null
          location?: string
          is_hub_event?: boolean
          cover_color?: string
          cover_image_url?: string | null
          youtube_url?: string | null
          social_links?: string[] | null
          registration_url?: string | null
          gallery?: string[] | null
          updated_at?: string
        }
      }
      posts: {
        Row: {
          id: string
          slug: string
          title: string
          excerpt: string
          content: string
          post_type: 'editorial' | 'announcement' | 'product_update' | 'event_recap' | 'research' | 'recruitment'
          tags: string[]
          author: string
          author_id: string | null
          cover_image_url: string | null
          is_published: boolean
          published_at: string | null
          created_at: string
          updated_at: string
          brand: 'nextrium' | 'zivana'
        }
        Insert: {
          id?: string
          slug: string
          title: string
          excerpt: string
          content: string
          post_type?: 'editorial' | 'announcement' | 'product_update' | 'event_recap' | 'research' | 'recruitment'
          tags?: string[]
          author: string
          author_id?: string | null
          cover_image_url?: string | null
          is_published?: boolean
          published_at?: string | null
          created_at?: string
          updated_at?: string
          brand?: 'nextrium' | 'zivana'
        }
        Update: {
          slug?: string
          title?: string
          excerpt?: string
          content?: string
          post_type?: 'editorial' | 'announcement' | 'product_update' | 'event_recap' | 'research' | 'recruitment'
          tags?: string[]
          author?: string
          author_id?: string | null
          cover_image_url?: string | null
          is_published?: boolean
          published_at?: string | null
          updated_at?: string
          brand?: 'nextrium' | 'zivana'
        }
      }
      applications: {
        Row: {
          id: string
          role_id: string | null
          name: string
          email: string
          cover_note: string | null
          cv_url: string | null
          role_title: string | null
          status: 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'accepted'
          phone: string | null
          location: string | null
          linkedin_url: string | null
          portfolio_url: string | null
          github_url: string | null
          design_url: string | null
          published_work_url: string | null
          currently_building: string | null
          project_links: { url: string; description: string }[] | null
          created_at: string
          updated_at: string
          first_reviewed_by: string | null
          first_reviewed_by_email: string | null
          first_reviewed_at: string | null
          last_reviewed_by: string | null
          last_reviewed_by_email: string | null
          last_reviewed_at: string | null
          needs_track_assignment: boolean
          track_assignment_flagged_at: string | null
          archived: boolean
          archived_at: string | null
          archived_reason: string | null
          archived_by: string | null
          archived_by_email: string | null
        }
        Insert: {
          id?: string
          role_id?: string | null
          name: string
          email: string
          cover_note?: string | null
          cv_url?: string | null
          role_title?: string | null
          status?: 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'accepted'
          phone?: string | null
          location?: string | null
          linkedin_url?: string | null
          portfolio_url?: string | null
          github_url?: string | null
          design_url?: string | null
          published_work_url?: string | null
          currently_building?: string | null
          project_links?: { url: string; description: string }[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          role_id?: string | null
          name?: string
          email?: string
          cover_note?: string | null
          cv_url?: string | null
          role_title?: string | null
          status?: 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'accepted'
          phone?: string | null
          location?: string | null
          linkedin_url?: string | null
          portfolio_url?: string | null
          github_url?: string | null
          design_url?: string | null
          published_work_url?: string | null
          currently_building?: string | null
          project_links?: { url: string; description: string }[] | null
          updated_at?: string
        }
      }
      team_members: {
        Row: {
          id: string
          slug: string
          name: string
          role: string
          bio: string | null
          detail: string | null
          photo_url: string | null
          email: string | null
          github_url: string | null
          linkedin_url: string | null
          twitter_url: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          role: string
          bio?: string | null
          detail?: string | null
          photo_url?: string | null
          email?: string | null
          github_url?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          slug?: string
          name?: string
          role?: string
          bio?: string | null
          detail?: string | null
          photo_url?: string | null
          email?: string | null
          github_url?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
      }
      contact_submissions: {
        Row: {
          id: string
          first_name: string
          last_name: string
          email: string
          organisation: string | null
          subject_type: 'services' | 'partnership' | 'investment' | 'press' | 'general'
          message: string
          status: 'new' | 'read' | 'replied' | 'archived'
          created_at: string
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          email: string
          organisation?: string | null
          subject_type?: 'services' | 'partnership' | 'investment' | 'press' | 'general'
          message: string
          status?: 'new' | 'read' | 'replied' | 'archived'
          created_at?: string
        }
        Update: {
          status?: 'new' | 'read' | 'replied' | 'archived'
        }
      }
      hub_projects: {
        Row: {
          id: string
          name: string
          team_name: string
          event_id: string | null
          description: string
          tags: string[]
          cover_color: string
          github_url: string | null
          website_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          team_name: string
          event_id?: string | null
          description: string
          tags?: string[]
          cover_color?: string
          github_url?: string | null
          website_url?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          team_name?: string
          event_id?: string | null
          description?: string
          tags?: string[]
          cover_color?: string
          github_url?: string | null
          website_url?: string | null
        }
      }
      roles: {
        Row: {
          id: string
          slug: string
          title: string
          team: string
          type: 'full_time' | 'contract' | 'volunteer' | 'internship'
          location: string
          description: string
          requirements: string[]
          is_active: boolean
          sort_order: number
          closes_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          team: string
          type?: 'full_time' | 'contract' | 'volunteer' | 'internship'
          location: string
          description: string
          requirements?: string[]
          is_active?: boolean
          sort_order?: number
          closes_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          slug?: string
          title?: string
          team?: string
          type?: 'full_time' | 'contract' | 'volunteer' | 'internship'
          location?: string
          description?: string
          requirements?: string[]
          is_active?: boolean
          sort_order?: number
          closes_at?: string | null
          updated_at?: string
        }
      }
      site_settings: {
        Row: {
          id: string
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Json
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Json
          updated_at?: string
        }
      }
      dashboard_users: {
        Row: {
          id: string
          user_id: string
          role: 'admin' | 'content' | 'community' | 'moderator'
          archived: boolean
          archived_at: string | null
          bio: string | null
          social_handles: Json
          discord_user_id: string | null
          discord_username: string | null
          discord_linked_at: string | null
          staff_track_id: string | null
          onboarding_completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role?: 'admin' | 'content' | 'community' | 'moderator'
          archived?: boolean
          archived_at?: string | null
          bio?: string | null
          social_handles?: Json
          discord_user_id?: string | null
          discord_username?: string | null
          discord_linked_at?: string | null
          staff_track_id?: string | null
          onboarding_completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          role?: 'admin' | 'content' | 'community' | 'moderator'
          archived?: boolean
          archived_at?: string | null
          bio?: string | null
          social_handles?: Json
          discord_user_id?: string | null
          discord_username?: string | null
          discord_linked_at?: string | null
          staff_track_id?: string | null
          onboarding_completed_at?: string | null
          updated_at?: string
        }
      }
      staff_tracks: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          description?: string | null
        }
      }
      automation_rules: {
        Row: {
          id: string
          name: string
          trigger_type: string
          trigger_config: Json
          action_type: string
          action_config: Json
          enabled: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          trigger_type: string
          trigger_config?: Json
          action_type: string
          action_config?: Json
          enabled?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          trigger_type?: string
          trigger_config?: Json
          action_type?: string
          action_config?: Json
          enabled?: boolean
          updated_at?: string
        }
      }
      automation_log: {
        Row: {
          id: string
          rule_id: string
          subject_type: string
          subject_id: string
          status: string
          detail: Json
          ran_at: string
        }
        Insert: {
          id?: string
          rule_id: string
          subject_type: string
          subject_id: string
          status?: string
          detail?: Json
          ran_at?: string
        }
        Update: {
          status?: string
          detail?: Json
        }
      }
      agent_screening_results: {
        Row: {
          id: string
          application_id: string
          input_hash: string
          composite_score: number
          consensus_tier: string
          recommendation: string
          evaluation_track: string
          full_result: Json
          screened_at: string
          email_sent: boolean
          webhook_sent: boolean
          last_emailed_recommendation: string | null
          last_emailed_at: string | null
          created_at?: string
        }
        Insert: {
          id?: string
          application_id: string
          input_hash: string
          composite_score: number
          consensus_tier: string
          recommendation: string
          evaluation_track?: string
          full_result: Json
          screened_at?: string
          email_sent?: boolean
          webhook_sent?: boolean
          created_at?: string
        }
        Update: {
          composite_score?: number
          consensus_tier?: string
          recommendation?: string
          evaluation_track?: string
          full_result?: Json
          screened_at?: string
          email_sent?: boolean
          webhook_sent?: boolean
        }
      }
      screening_reports: {
        Row: {
          id: string
          application_id: string
          composite_score: number
          evaluation_track: string
          recommendation: string
          consensus_tier: string
          feedback_body: string
          dimension_scores: Json
          rebuttal_submitted: boolean
          rebuttal_locked: boolean
          created_at?: string
        }
        Insert: {
          id: string
          application_id: string
          composite_score: number
          evaluation_track?: string
          recommendation: string
          consensus_tier: string
          feedback_body: string
          dimension_scores?: Json
          rebuttal_submitted?: boolean
          rebuttal_locked?: boolean
          created_at?: string
        }
        Update: {
          composite_score?: number
          evaluation_track?: string
          recommendation?: string
          consensus_tier?: string
          feedback_body?: string
          dimension_scores?: Json
          rebuttal_submitted?: boolean
          rebuttal_locked?: boolean
        }
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
  }
}

// Convenience row types — import these directly in pages and components
export type Profile              = Database['public']['Tables']['profiles']['Row']
export type Product              = Database['public']['Tables']['products']['Row']
export type Service              = Database['public']['Tables']['services']['Row']
export type NTEvent              = Database['public']['Tables']['events']['Row']
export type Post                 = Database['public']['Tables']['posts']['Row']
export type Application          = Database['public']['Tables']['applications']['Row']
export type TeamMember           = Database['public']['Tables']['team_members']['Row']
export type ContactSubmission    = Database['public']['Tables']['contact_submissions']['Row']
export type HubProject           = Database['public']['Tables']['hub_projects']['Row']
export type Role                 = Database['public']['Tables']['roles']['Row']
export type SiteSetting          = Database['public']['Tables']['site_settings']['Row']
export type DashboardUser        = Database['public']['Tables']['dashboard_users']['Row']
export type StaffTrack           = Database['public']['Tables']['staff_tracks']['Row']
export type AutomationRule       = Database['public']['Tables']['automation_rules']['Row']
export type AutomationLog        = Database['public']['Tables']['automation_log']['Row']
export type AgentScreeningResult = Database['public']['Tables']['agent_screening_results']['Row']
export type ScreeningReport      = Database['public']['Tables']['screening_reports']['Row']

export interface CommunityProject {
  id:          string
  slug:        string
  name:        string
  team:        string
  event:       string
  description: string
  tags:        string[]
  status:      string
  website_url: string | null
  github_url:  string | null
  cover_color: string
  is_featured: boolean
  sort_order:  number
  created_at:  string
  updated_at:  string
}

