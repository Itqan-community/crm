-- =====================================================================
-- dashboard_metrics — weekly KPI store for the admin dashboard.
--
-- One row per (week_start, metric_key). Flat namespaced keys keep the
-- query side simple ('engagement.total', 'social_reach.x', etc.) and
-- forward-compatible: future automated writers (e.g. an analytics
-- backfill job) can target the same keys without schema changes.
--
-- week_start is the Sunday-anchored start of a Sun→Sat KSA week, stored
-- as a DATE — time-of-day is meaningless for weekly buckets.
--
-- RLS: team members read; admins write. The public form does not touch
-- this table; the service_role used by edge writers bypasses RLS, but
-- there are no automated writers yet — every value lands via the admin
-- UI's server action.
-- =====================================================================

create table public.dashboard_metrics (
  id           uuid primary key default gen_random_uuid(),
  week_start   date not null,
  metric_key   text not null,
  value        bigint not null default 0,
  notes        text,
  updated_by   uuid references public.team_members(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (week_start, metric_key)
);

create index dashboard_metrics_week on public.dashboard_metrics (week_start desc);
create index dashboard_metrics_key  on public.dashboard_metrics (metric_key);

create trigger dashboard_metrics_updated_at
  before update on public.dashboard_metrics
  for each row execute function public.set_updated_at();

alter table public.dashboard_metrics enable row level security;

create policy dashboard_metrics_team_read
  on public.dashboard_metrics for select
  using (public.is_team_member());

create policy dashboard_metrics_admin_insert
  on public.dashboard_metrics for insert
  with check (public.is_admin());

create policy dashboard_metrics_admin_update
  on public.dashboard_metrics for update
  using (public.is_admin())
  with check (public.is_admin());

create policy dashboard_metrics_admin_delete
  on public.dashboard_metrics for delete
  using (public.is_admin());
