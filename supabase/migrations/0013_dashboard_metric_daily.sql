-- =====================================================================
-- Daily metric snapshots — one row per (day, metric_key) so the
-- dashboard's sparklines and the hero area chart can show movement
-- over time. The composite primary key makes upserts cheap (a daily
-- cron / manual capture just calls `insert ... on conflict do update`).
--
-- Metric keys (matched in src/lib/dashboard/load.ts):
--   engagement      — total community interactions across the day
--   newsletter_sent — newsletter sends in the day (or rolling 7d avg)
--   social_reach    — sum of impressions across all social channels
--   site_visits     — GA pageviews
--   publishers      — cumulative publisher count
--   beneficiaries   — cumulative beneficiary count
--   consumption     — cumulative asset count
--   shares          — community shares / forum likes
-- =====================================================================

create table public.dashboard_metric_daily (
  day date not null,
  metric_key text not null,
  value bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (day, metric_key)
);

create index dashboard_metric_daily_metric_recent_idx
  on public.dashboard_metric_daily (metric_key, day desc);

create or replace function public.touch_dashboard_metric_daily()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger dashboard_metric_daily_touch
  before update on public.dashboard_metric_daily
  for each row execute procedure public.touch_dashboard_metric_daily();

alter table public.dashboard_metric_daily enable row level security;

create policy dashboard_metric_daily_team_read
  on public.dashboard_metric_daily
  for select using (public.is_team_member());

create policy dashboard_metric_daily_admin_write
  on public.dashboard_metric_daily
  for all using (public.is_admin()) with check (public.is_admin());
