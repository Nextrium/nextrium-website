-- Nextrium Website — website-owned schema additions.
-- Scope: tables the dashboard itself owns (not the AI screening engine).
-- agents-engine owns its own schema.sql separately for engine-related tables.
-- All statements here are additive and safe to re-run.

-- Table: Team activity log — every meaningful staff action on the dashboard,
-- including sign-in/sign-out.
create table if not exists public.team_activity_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid,
  actor_email text,
  action      text not null,
  target_type text,
  target_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_team_activity_logs_created_at on public.team_activity_logs(created_at desc);
create index if not exists idx_team_activity_logs_actor_id on public.team_activity_logs(actor_id);
create index if not exists idx_team_activity_logs_action on public.team_activity_logs(action);

alter table public.team_activity_logs enable row level security;
grant select, insert on public.team_activity_logs to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'team_activity_logs'
    and policyname = 'Admins can read team activity logs'
  ) then
    create policy "Admins can read team activity logs"
      on public.team_activity_logs for select
      to authenticated
      using (
        exists (
          select 1 from public.dashboard_users
          where dashboard_users.user_id = auth.uid()
          and dashboard_users.role = 'admin'
        )
      );
  end if;
end $$;

-- Staff archive: revokes a dashboard user's access without hard-deleting
-- them (which would lose their activity-log attribution, since
-- team_activity_logs.actor_id has no FK to enforce referential integrity
-- but is still meant to identify who did what historically). Enforced two
-- ways: (1) the 'archived' pseudo-role in lib/dashboard/accessControl.ts
-- blocks every /dashboard path at the app layer, checked on every request
-- via proxy.ts and lib/dashboard/getRole.ts; (2) the archive action also
-- bans the underlying auth.users record (ban_duration) so their session
-- cannot authenticate at all going forward, independent of app-layer
-- checks or whatever RLS policies may or may not exist on other tables.
alter table public.dashboard_users add column if not exists archived boolean not null default false;
alter table public.dashboard_users add column if not exists archived_at timestamptz;

-- Staff & Team Profiles + operational workflow automation engine.
--
-- Staff tracks: a staff-specific grouping (department/pod), distinct from
-- the HR applicant evaluation track concept used elsewhere in this schema.
-- Automation rules reference a track to know which external resource
-- (Discord role, etc.) it maps to.
create table if not exists public.staff_tracks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

alter table public.staff_tracks enable row level security;
grant select, insert, update, delete on public.staff_tracks to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'staff_tracks'
    and policyname = 'Active dashboard users can read staff tracks'
  ) then
    create policy "Active dashboard users can read staff tracks"
      on public.staff_tracks for select
      to authenticated
      using (
        exists (
          select 1 from public.dashboard_users
          where dashboard_users.user_id = auth.uid()
          and dashboard_users.archived = false
        )
      );
  end if;
end $$;

-- Staff profile fields. social_handles is a flexible jsonb bag (e.g.
-- {"twitter": "...", "linkedin": "...", "github": "..."}) so adding a new
-- platform later never needs a migration. discord_user_id is the verified
-- numeric snowflake captured via OAuth link, kept separate from
-- discord_username (display only) — the bot API needs the ID, not the
-- free-text handle, to assign roles reliably. onboarding_completed_at
-- null means the staff member hasn't finished the forced post-invite
-- profile setup yet.
alter table public.dashboard_users add column if not exists bio text;
alter table public.dashboard_users add column if not exists social_handles jsonb not null default '{}'::jsonb;
alter table public.dashboard_users add column if not exists discord_user_id text;
alter table public.dashboard_users add column if not exists discord_username text;
alter table public.dashboard_users add column if not exists discord_linked_at timestamptz;
alter table public.dashboard_users add column if not exists staff_track_id uuid references public.staff_tracks(id) on delete set null;
alter table public.dashboard_users add column if not exists onboarding_completed_at timestamptz;

create unique index if not exists idx_dashboard_users_discord_user_id on public.dashboard_users(discord_user_id) where discord_user_id is not null;

-- Operational workflow automation engine. trigger_type/action_type are
-- free-text keys matched against a small in-code handler registry
-- (lib/automation/) — a new automation is a new row here plus one new
-- handler function, never a new hardcoded pipeline. trigger_config and
-- action_config hold whatever parameters that specific trigger/action
-- needs (e.g. {"trackId": "..."} / {"discordRoleId": "..."}).
create table if not exists public.automation_rules (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  trigger_type   text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  action_type    text not null,
  action_config  jsonb not null default '{}'::jsonb,
  enabled        boolean not null default true,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_automation_rules_trigger_type on public.automation_rules(trigger_type) where enabled = true;

alter table public.automation_rules enable row level security;
grant select, insert, update, delete on public.automation_rules to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'automation_rules'
    and policyname = 'Admins can manage automation rules'
  ) then
    create policy "Admins can manage automation rules"
      on public.automation_rules for all
      to authenticated
      using (
        exists (
          select 1 from public.dashboard_users
          where dashboard_users.user_id = auth.uid()
          and dashboard_users.role = 'admin'
        )
      )
      with check (
        exists (
          select 1 from public.dashboard_users
          where dashboard_users.user_id = auth.uid()
          and dashboard_users.role = 'admin'
        )
      );
  end if;
end $$;

-- Idempotency ledger: records that a given rule has already fired for a
-- given subject (e.g. this staff member), so a re-triggered event (an
-- unrelated profile edit, a webhook retry, etc.) never re-runs an action
-- that's already been applied — mirrors the email dedup discipline used
-- elsewhere in this app (agent_screening_results.last_emailed_recommendation).
create table if not exists public.automation_log (
  id           uuid primary key default gen_random_uuid(),
  rule_id      uuid not null references public.automation_rules(id) on delete cascade,
  subject_type text not null,
  subject_id   text not null,
  status       text not null default 'success',
  detail       jsonb not null default '{}'::jsonb,
  ran_at       timestamptz not null default now()
);

create unique index if not exists idx_automation_log_rule_subject on public.automation_log(rule_id, subject_type, subject_id) where status = 'success';
create index if not exists idx_automation_log_ran_at on public.automation_log(ran_at desc);

alter table public.automation_log enable row level security;
grant select, insert on public.automation_log to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'automation_log'
    and policyname = 'Admins can read automation log'
  ) then
    create policy "Admins can read automation log"
      on public.automation_log for select
      to authenticated
      using (
        exists (
          select 1 from public.dashboard_users
          where dashboard_users.user_id = auth.uid()
          and dashboard_users.role = 'admin'
        )
      );
  end if;
end $$;
