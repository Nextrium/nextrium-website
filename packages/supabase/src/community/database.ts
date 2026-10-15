// Types for the community database (the contributor portal's Supabase project).
// Generated on 2026-10-14 from the project's REST schema (function return types checked
// against their definitions); regenerate when its tables change.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type CommunityDatabase = {
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          id: string
          actor_id: string | null
          actor_name: string
          action: string
          target_type: string | null
          target_id: string | null
          target_label: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          actor_name: string
          action: string
          target_type?: string | null
          target_id?: string | null
          target_label?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          actor_name?: string
          action?: string
          target_type?: string | null
          target_id?: string | null
          target_label?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      contributions: {
        Row: {
          id: string
          contributor_id: string | null
          task_id: string | null
          title: string
          description: string | null
          category: string
          complexity: string
          base_points: number
          final_points: number | null
          multiplier: number | null
          evidence_url: string | null
          status: string | null
          verified_at: string | null
          notes: string | null
          created_at: string | null
          verified_by: string | null
          timing_multiplier: number | null
          deadline_at: string | null
          submission_count: number | null
          review_decision: string | null
          review_score: number | null
          review_feedback: Json | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          contributor_id?: string | null
          task_id?: string | null
          title: string
          description?: string | null
          category: string
          complexity: string
          base_points: number
          final_points?: number | null
          multiplier?: number | null
          evidence_url?: string | null
          status?: string | null
          verified_at?: string | null
          notes?: string | null
          created_at?: string | null
          verified_by?: string | null
          timing_multiplier?: number | null
          deadline_at?: string | null
          submission_count?: number | null
          review_decision?: string | null
          review_score?: number | null
          review_feedback?: Json | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          contributor_id?: string | null
          task_id?: string | null
          title?: string
          description?: string | null
          category?: string
          complexity?: string
          base_points?: number
          final_points?: number | null
          multiplier?: number | null
          evidence_url?: string | null
          status?: string | null
          verified_at?: string | null
          notes?: string | null
          created_at?: string | null
          verified_by?: string | null
          timing_multiplier?: number | null
          deadline_at?: string | null
          submission_count?: number | null
          review_decision?: string | null
          review_score?: number | null
          review_feedback?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contributors: {
        Row: {
          id: string
          email: string
          name: string
          github_handle: string | null
          twitter_handle: string | null
          linkedin_url: string | null
          portfolio_url: string | null
          skills: string[] | null
          timezone: string | null
          contributor_type: string | null
          team_name: string | null
          availability_hours_per_week: number | null
          bio: string | null
          location: string | null
          wallet_address: string | null
          status: string | null
          total_points: number | null
          verified_contributions: number | null
          created_at: string | null
          user_id: string | null
          categories: string[]
          telegram_chat_id: string | null
          notification_email: boolean | null
          notification_telegram: boolean | null
          max_claims: number | null
          rejection_reason: string | null
          revision_notes: string | null
        }
        Insert: {
          id?: string
          email: string
          name: string
          github_handle?: string | null
          twitter_handle?: string | null
          linkedin_url?: string | null
          portfolio_url?: string | null
          skills?: string[] | null
          timezone?: string | null
          contributor_type?: string | null
          team_name?: string | null
          availability_hours_per_week?: number | null
          bio?: string | null
          location?: string | null
          wallet_address?: string | null
          status?: string | null
          total_points?: number | null
          verified_contributions?: number | null
          created_at?: string | null
          user_id?: string | null
          categories: string[]
          telegram_chat_id?: string | null
          notification_email?: boolean | null
          notification_telegram?: boolean | null
          max_claims?: number | null
          rejection_reason?: string | null
          revision_notes?: string | null
        }
        Update: {
          id?: string
          email?: string
          name?: string
          github_handle?: string | null
          twitter_handle?: string | null
          linkedin_url?: string | null
          portfolio_url?: string | null
          skills?: string[] | null
          timezone?: string | null
          contributor_type?: string | null
          team_name?: string | null
          availability_hours_per_week?: number | null
          bio?: string | null
          location?: string | null
          wallet_address?: string | null
          status?: string | null
          total_points?: number | null
          verified_contributions?: number | null
          created_at?: string | null
          user_id?: string | null
          categories?: string[]
          telegram_chat_id?: string | null
          notification_email?: boolean | null
          notification_telegram?: boolean | null
          max_claims?: number | null
          rejection_reason?: string | null
          revision_notes?: string | null
        }
        Relationships: []
      }
      core_team: {
        Row: {
          id: string
          user_id: string | null
          email: string
          name: string
          role: string
          department: string
          permissions: string[] | null
          is_active: boolean | null
          joined_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          email: string
          name: string
          role: string
          department: string
          permissions?: string[] | null
          is_active?: boolean | null
          joined_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          email?: string
          name?: string
          role?: string
          department?: string
          permissions?: string[] | null
          is_active?: boolean | null
          joined_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          contributor_id: string | null
          full_name: string | null
          avatar_url: string | null
          wallet_address: string | null
          portfolio_url: string | null
          skills: string[] | null
          timezone: string | null
          contributor_type: string | null
          team_name: string | null
          availability_hours_per_week: number | null
          onboarded: boolean | null
          created_at: string | null
        }
        Insert: {
          id: string
          contributor_id?: string | null
          full_name?: string | null
          avatar_url?: string | null
          wallet_address?: string | null
          portfolio_url?: string | null
          skills?: string[] | null
          timezone?: string | null
          contributor_type?: string | null
          team_name?: string | null
          availability_hours_per_week?: number | null
          onboarded?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          contributor_id?: string | null
          full_name?: string | null
          avatar_url?: string | null
          wallet_address?: string | null
          portfolio_url?: string | null
          skills?: string[] | null
          timezone?: string | null
          contributor_type?: string | null
          team_name?: string | null
          availability_hours_per_week?: number | null
          onboarded?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          category: string
          complexity: string
          point_range_min: number
          point_range_max: number
          status: string | null
          assigned_to: string | null
          created_at: string | null
          deadline_days: number | null
          claimed_at: string | null
          deadline_at: string | null
          extension_granted: boolean | null
          extension_requested_at: string | null
          extended_deadline_at: string | null
          unclaimed_by: string[] | null
          unclaimed_at: string[] | null
          primitives: string[] | null
          links: Json | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          category: string
          complexity: string
          point_range_min: number
          point_range_max: number
          status?: string | null
          assigned_to?: string | null
          created_at?: string | null
          deadline_days?: number | null
          claimed_at?: string | null
          deadline_at?: string | null
          extension_granted?: boolean | null
          extension_requested_at?: string | null
          extended_deadline_at?: string | null
          unclaimed_by?: string[] | null
          unclaimed_at?: string[] | null
          primitives?: string[] | null
          links?: Json | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          category?: string
          complexity?: string
          point_range_min?: number
          point_range_max?: number
          status?: string | null
          assigned_to?: string | null
          created_at?: string | null
          deadline_days?: number | null
          claimed_at?: string | null
          deadline_at?: string | null
          extension_granted?: boolean | null
          extension_requested_at?: string | null
          extended_deadline_at?: string | null
          unclaimed_by?: string[] | null
          unclaimed_at?: string[] | null
          primitives?: string[] | null
          links?: Json | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      // claim_task / unclaim_task check the caller themselves unless called with
      // the service key; the portal passes only a verified, active contributor.
      // The deadline arguments are ignored: the deadline comes from the task.
      claim_task: {
        Args: { task_id: string; contributor_id: string; deadline_days_val: number; deadline_at_val: string }
        Returns: boolean
      }
      unclaim_task: {
        Args: { task_id: string; contributor_id: string }
        Returns: undefined
      }
      check_claim_cooldown: {
        Args: { task_id: string; contributor_id: string }
        Returns: boolean
      }
      get_public_contributors: {
        Args: Record<string, never>
        Returns: {
          id: string
          name: string
          categories: string[]
          location: string | null
          contributor_type: string | null
          team_name: string | null
          total_points: number | null
          verified_contributions: number | null
        }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type Tables = CommunityDatabase['public']['Tables']
export type Contributor       = Tables['contributors']['Row']
export type CommunityTask     = Tables['tasks']['Row']
export type CommunityContribution = Tables['contributions']['Row']
export type CoreTeamMember    = Tables['core_team']['Row']
export type CommunityAuditEntry = Tables['admin_audit_log']['Row']
