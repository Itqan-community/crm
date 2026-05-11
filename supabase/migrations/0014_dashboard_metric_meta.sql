-- =====================================================================
-- Add a `meta` jsonb column to dashboard_metric_daily so we can store
-- the per-metric sub-fields the dashboard needs (newsletter open
-- rate, site visits uniq/returning split, engagement breakdown by
-- type, …) without one column per field.
--
-- Why: /admin used to query the live stats bundle (MailerLite, GA,
-- Flarum, CMS) on every page load to pull these sub-fields. With
-- meta on the daily snapshot we can serve the entire dashboard from
-- a single Supabase query — 5–10× faster on first paint.
-- =====================================================================

alter table public.dashboard_metric_daily
  add column meta jsonb not null default '{}'::jsonb;
