# Dashboard work — handoff

State as of this commit. Read this first in the next session.

## Where things live

- **Worktree:** `/Users/ash/ITQAN/code/crm/.claude/worktrees/musing-mclean-4f7e1f`
- **Branch:** `claude/dashboard-data-wiring` (pushed to origin)
- **PR:** `claude/dashboard-data-wiring` → `main` (see PR for the full diff narrative)
- **Production Supabase:** `cfbfbzgzqqkrmnjbxeca` (ITQAN CRM). Reachable via Supabase MCP.
- **Vercel project:** `prj_M34ECeaMeuoyVivl2rcVdiQ4giwD` (team `team_Wih7t2icUh1zTKVqdSKIl0T3`).
  Preview alias: `crm-git-claude-dashboard-data-wiring-itqan-community.vercel.app`.

## What `/admin` looks like now

1. **Hero band** — engagement number aggregated over the selected window (day/week/month) with previous-period delta. Calendar-week area chart, Sunday-first labels (أحد right, سبت left).
2. **Community + Platform sections** — newsletter ring, social reach card, site visits sparkline, publishers / beneficiaries / consumption / shares cards.
3. **MetricsTable at the bottom** (admin-only) — per-metric card with a 7-column Sun→Sat grid of editable inputs for last week. Edits save with `is_manual=true` and are protected from cron / backfill overwrites (📌 next to weekday label).

`/admin/settings/metrics` has: social channel snapshots editor, "إعادة ملء آخر 30 يوم" button, RawCampaignsInspector showing MailerLite's actual response per campaign.

## Data model (`dashboard_metric_daily`)

Columns: `day date, metric_key text, value bigint, meta jsonb, is_manual bool, created_at, updated_at`. PK `(day, metric_key)`.

Metric keys + what `value` means:
- `engagement` — sum of forum posts + discussions THAT DAY (flow). Meta: `{replies, likes, mentions, shares}`.
- `newsletter` — campaign sent count THAT DAY. Meta: `{rate, opened, prevRate, clicks_daily}`. **opens come from CSV import (MailerLite_Daily.csv, 252 rows imported)** — real per-day numbers, not derived.
- `social_reach` — sum of latest social snapshot impressions/page_views/followers per channel (cumulative).
- `site_visits` — GA pageviews THAT DAY (flow). Meta: `{uniq, returning}`.
- `publishers` / `beneficiaries` / `consumption` — cumulative count from CMS as of that day.
- `shares` — cumulative forum likes as of that day.

`is_manual=true` rows are pinned: `writeDailyRows({ preserveManual: true })` skips them. `saveWeeklyMetrics` server action (called from MetricsTable) writes with `is_manual=true` and `preserveManual: false`.

## Architecture quick map

- `src/lib/dashboard/load.ts` — adapter that builds `DashboardData` from `dashboard_metric_daily` only. Window-aware aggregation (flow → sum, cumulative → latest). No live source calls in the hot path.
- `src/lib/dashboard/daily.ts` — `writeDailyRows`, `loadLatestSnapshots`, `loadCalendarWeekSeries`. Metric semantic map (flow/cumulative).
- `src/lib/dashboard/backfill.ts` — `backfillDailyMetrics({days})`. Queries Flarum / CMS / GA / MailerLite directly, writes daily rows with `preserveManual: true`. Decay curve for newsletter (14d).
- `src/lib/dashboard/queries.ts` — `loadSocialEditorRows`, `loadLastWeekForEdit` (powers MetricsTable), `METRIC_DEFINITIONS`.
- `src/lib/dashboard/actions.ts` — `saveWeeklyMetrics`, `saveSocialSnapshot` server actions.
- `src/app/admin/page.tsx` — renders `<Dashboard data={...} window={...} editable={...} />`. Reads `?window=day|week|month`, defaults to `week`. Admin-only `editable` prop.

## API surfaces

- `GET /api/cron/dashboard-metrics` (Vercel Cron @ 02:00 UTC) — daily snapshot. Needs `CRON_SECRET` Bearer.
- `GET /api/cron/dashboard-metrics?backfill=N` — runs N-day backfill via the cron secret.
- `POST /api/admin/dashboard-backfill` — same backfill via Supabase admin session (called from BackfillButton).
- `GET /api/admin/dashboard-campaigns` — MailerLite raw payload for the RawCampaignsInspector.
  `?raw=1` returns the unparsed response (used 0 vs 280 bug; verified `opens_count` is the right field).
- `GET /api/dashboard-tester[?action=backfill|capture|campaigns]` — CRON_SECRET-gated diagnostics. Tester-access surface for users without an admin session.

## Migrations applied to production

0012 `dashboard_social_snapshots`, 0013 `dashboard_metric_daily`, 0014 `dashboard_metric_meta` (jsonb meta column), 0015 `dashboard_metric_manual_flag` (`is_manual` boolean). All applied via Supabase MCP.

## Open work

1. **CRON_SECRET** in Vercel — confirm it's set so the daily cron + tester endpoint authorize. Verify by hitting `/api/dashboard-tester` with the token.
2. **CMS metrics (publishers / beneficiaries / consumption) still show 0 rows.** The CMS env var (`stat_app_CMS_DB_URL`) may be missing OR the connection fails. Diagnose via `/admin/stats` page (built in PR #28) which shows per-source config + errors.
3. **MailerLite webhooks for real-time per-day opens** — proposed but not implemented. CSV import gave us historical, but going forward we'd need either: (a) repeat CSV uploads, (b) `campaign.open` webhook → store events → aggregate per day, (c) accept that historical is real and going-forward is the decay estimate.
4. **Other Vercel env vars** for GA / Flarum to populate `engagement`, `site_visits`, `shares` properly across all days (currently only what backfill captured at the moment of the click).

## How to continue in a new session

Open a fresh chat and paste:

```
Continue dashboard work on PR claude/dashboard-data-wiring at
/Users/ash/ITQAN/code/crm/.claude/worktrees/musing-mclean-4f7e1f.
Read HANDOFF.md first, then `gh pr view` for the full diff narrative.
Supabase production project id: cfbfbzgzqqkrmnjbxeca (use MCP).
```

That's enough — the new Claude can `cat HANDOFF.md`, `gh pr view`, and pick up where this one stopped.
