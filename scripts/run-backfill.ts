// One-off backfill runner — invokes backfillDailyMetrics with whatever
// env is present in the local .env.local. Use only for local testing /
// diagnostics. Writes to the production Supabase indicated by
// NEXT_PUBLIC_SUPABASE_URL (same as the app reads).

import { config as loadEnv } from 'dotenv';
import path from 'node:path';

loadEnv({ path: path.resolve(__dirname, '../.env.local') });
loadEnv({ path: path.resolve(__dirname, '../.env') });

const sources = {
  mailerlite: !!process.env.mailerlite_API_KEY,
  flarum: !!process.env.stat_app_FLARUM_DB_URL,
  cms: !!process.env.stat_app_CMS_DB_URL,
  ga_oauth: !!(
    process.env.stat_app_GA_OAUTH_CLIENT_ID &&
    process.env.stat_app_GA_OAUTH_CLIENT_SECRET &&
    process.env.stat_app_GA_OAUTH_REFRESH_TOKEN
  ),
  ga_property: !!process.env.GA_PROPERTY_ID_itqan_dev,
  supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
};
console.log('Source env vars locally:', sources);

async function main() {
  const { backfillDailyMetrics } = await import('../src/lib/dashboard/backfill');
  const days = Number(process.argv[2] ?? '30');
  console.log(`\nBackfilling last ${days} days…`);
  const result = await backfillDailyMetrics({ days });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error('Backfill failed:', e);
  process.exit(1);
});
