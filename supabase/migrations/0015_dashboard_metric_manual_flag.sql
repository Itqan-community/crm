-- =====================================================================
-- Add an `is_manual` flag to dashboard_metric_daily so admin-entered
-- values (via the bottom-of-/admin MetricsTable) survive the daily
-- cron + backfill runs. The cron writes from live sources; both it
-- and the backfill now skip rows already flagged manual instead of
-- overwriting them.
-- =====================================================================

alter table public.dashboard_metric_daily
  add column is_manual boolean not null default false;

-- Index isn't necessary at this scale — the table holds ≤ 8 metrics ×
-- a few years of days, well under any threshold where a partial index
-- would matter.
