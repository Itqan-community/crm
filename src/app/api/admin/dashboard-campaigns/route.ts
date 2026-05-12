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

  // ?raw=1 mode: hit MailerLite directly and dump the unparsed JSON.
  // Lets us see exactly what fields the API returns — or if it errors,
  // what the error message says. The URL is constructed entirely
  // server-side from a fixed origin and a `limit` query param the user
  // can tune, so no taint flows from request.url into fetch() — CodeQL
  // confirms there's no SSRF path here.
  if (new URL(request.url).searchParams.get('raw') === '1') {
    const apiKey = process.env.mailerlite_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ configured: false, hint: 'mailerlite_API_KEY missing' });
    }
    // MailerLite rejects `limit` below 10 ("The selected limit is
    // invalid"). Clamp to a sane range so the diagnostic stays cheap.
    const limitRaw = parseInt(
      new URL(request.url).searchParams.get('limit') ?? '10',
      10,
    );
    const limit = Number.isFinite(limitRaw)
      ? Math.max(10, Math.min(100, limitRaw))
      : 10;
    const target = new URL('https://connect.mailerlite.com/api/campaigns');
    target.searchParams.set('filter[status]', 'sent');
    target.searchParams.set('limit', String(limit));
    const res = await fetch(target.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = { raw_text: text }; }
    type R = { data?: Array<Record<string, unknown>> };
    const first = (json as R).data?.[0];
    return NextResponse.json({
      ok: res.ok,
      http_status: res.status,
      url_used: target.toString(),
      body_on_error: res.ok ? null : json,
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
