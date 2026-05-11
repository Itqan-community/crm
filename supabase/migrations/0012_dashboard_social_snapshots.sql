-- =====================================================================
-- Dashboard manual metrics — social channel snapshots.
--
-- The /admin dashboard pulls most numbers from the stats infrastructure
-- (MailerLite, GA, GitHub, Flarum, CMS) but social-network metrics
-- (LinkedIn, Facebook, X/Instagram/YouTube) have no API source today —
-- the team enters them by hand each week from each platform's analytics
-- tab. This table stores those snapshots so:
--   1. The dashboard can render the latest values per channel.
--   2. Week-over-week deltas can be computed once we have ≥2 snapshots.
--
-- Shape:
--   - One row per (channel, snapshot_date).
--   - Common metrics (followers, impressions, engagements, …) get
--     dedicated columns so the entry form is structured.
--   - Per-channel one-offs (LinkedIn search appearances, X reposts /
--     bookmarks, …) live in `extra` jsonb to avoid migrations every
--     time a platform exposes a new metric.
-- =====================================================================

create type public.social_channel as enum (
  'linkedin', 'facebook', 'x', 'instagram', 'youtube'
);

create table public.dashboard_social_snapshots (
  id uuid primary key default gen_random_uuid(),
  channel public.social_channel not null,
  -- The reporting period the numbers represent (typically a Sunday for
  -- "week ending"). Date-only — no timezone games.
  snapshot_date date not null,

  -- Core metrics (nullable — not every platform exposes every one).
  followers_total integer,
  followers_new integer,
  impressions integer,
  page_views integer,
  unique_visitors integer,
  engagements integer,

  -- Channel-specific extras: { search_appearances: 655, likes: 31, ... }
  extra jsonb not null default '{}'::jsonb,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (channel, snapshot_date)
);

create index dashboard_social_snapshots_recent_idx
  on public.dashboard_social_snapshots (channel, snapshot_date desc);

-- updated_at maintenance — reuse the trigger pattern from 0001_init.
create or replace function public.touch_dashboard_social_snapshots()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger dashboard_social_snapshots_touch
  before update on public.dashboard_social_snapshots
  for each row execute procedure public.touch_dashboard_social_snapshots();

-- ---------------------------------------------------------------------
-- RLS — read for any team member, write for admins only.
-- ---------------------------------------------------------------------
alter table public.dashboard_social_snapshots enable row level security;

create policy dashboard_social_snapshots_team_read
  on public.dashboard_social_snapshots
  for select using (public.is_team_member());

create policy dashboard_social_snapshots_admin_write
  on public.dashboard_social_snapshots
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Seed: user-provided numbers for the week ending today (2026-05-10).
-- Replace via the /admin/settings/metrics form once a newer week is in.
-- ---------------------------------------------------------------------
insert into public.dashboard_social_snapshots
  (channel, snapshot_date, followers_total, followers_new, impressions, page_views, unique_visitors, engagements, extra)
values
  ('linkedin', date '2026-05-10', 2942, 44, 3100, 71,   28,   54, '{"search_appearances": 655}'::jsonb),
  ('facebook', date '2026-05-10',  137, 24, NULL,  592, 217, 458, '{}'::jsonb),
  ('x',        date '2026-05-10',  791, 348, 11315, NULL, NULL, 798,
    '{"likes": 31, "replies": 20, "reposts": 6, "shares": 7, "bookmarks": 12, "profile_visits": 86}'::jsonb)
on conflict (channel, snapshot_date) do update set
  followers_total = excluded.followers_total,
  followers_new   = excluded.followers_new,
  impressions     = excluded.impressions,
  page_views      = excluded.page_views,
  unique_visitors = excluded.unique_visitors,
  engagements     = excluded.engagements,
  extra           = excluded.extra,
  updated_at      = now();
