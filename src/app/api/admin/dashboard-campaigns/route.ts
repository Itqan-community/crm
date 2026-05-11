// Returns the raw MailerLite campaign list to admin browsers. Same
// data the cron sees — sent count, raw unique_opens_count, derived
// opens from rate, open/click rates per campaign. Use this when the
// dashboard's daily opens distribution looks wrong and you want to
// compare against the source numbers.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { data: tm } = await supabase
    .from('team_members')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (!tm || tm.role !== 'admin') {
    return NextResponse.json({ error: 'admin_required' }, { status: 403 });
  }

  // ?raw=1 mode: fetch MailerLite directly and dump the FIRST campaign's
  // unparsed JSON. Lets us see exactly what fields the API actually
  // returns, independent of our parsing.
  if (new URL(request.url).searchParams.get('raw') === '1') {
    const apiKey = process.env.mailerlite_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ configured: false, hint: 'mailerlite_API_KEY missing' });
    }
    const res = await fetch(
      'https://connect.mailerlite.com/api/campaigns?filter[status]=sent&limit=3',
      { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } },
    );
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = { raw_text: text }; }
    // Return as-is, but pluck the first campaign + its stats so it's
    // easy to scan.
    type R = { data?: Array<Record<string, unknown>> };
    const first = (json as R).data?.[0];
    return NextResponse.json({
      configured: true,
      http_status: res.status,
      first_campaign_keys: first ? Object.keys(first) : [],
      first_campaign_stats: first?.stats ?? null,
      first_campaign_full: first ?? null,
    });
  }

  const { getNewsletter } = await import('@/lib/stats/sources/mailerlite');
  const n = await getNewsletter();
  if (!n) {
    return NextResponse.json({
      configured: false,
      hint: 'mailerlite_API_KEY env var is missing or invalid.',
    });
  }
  return NextResponse.json({
    configured: true,
    activeSubscribers: n.activeSubscribers,
    last7Days: n.last7Days,
    lastCampaign: n.lastCampaign,
    recentCampaigns: n.recentCampaigns.map((c) => ({
      id: c.id,
      name: c.name,
      subject: c.subject,
      sentAt: c.sentAt,
      sent: c.sent,
      opens_raw_from_API: c.opens,
      opens_derived_from_rate: Math.round((c.sent * c.openRate) / 100),
      openRate_pct: c.openRate,
      clicks: c.clicks,
      clickRate_pct: c.clickRate,
    })),
  });
}
