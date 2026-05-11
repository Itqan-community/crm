// Returns the raw MailerLite campaign list to admin browsers. Same
// data the cron sees — sent count, raw unique_opens_count, derived
// opens from rate, open/click rates per campaign. Use this when the
// dashboard's daily opens distribution looks wrong and you want to
// compare against the source numbers.

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
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
