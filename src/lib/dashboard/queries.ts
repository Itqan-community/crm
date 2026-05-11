// Server-side queries for the manual-metrics admin form. Mirrors the
// loader-side query in load.ts but returns rows in a simpler shape for
// the editor (latest snapshot per channel).

import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  type SocialChannelKey,
  type SocialSnapshot,
  DISPLAYED_CHANNELS,
} from './types';

export type SocialEditorRow = {
  channel: SocialChannelKey;
  latest: SocialSnapshot | null;
};

export async function loadSocialEditorRows(): Promise<SocialEditorRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('dashboard_social_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false });
  const byChannel = new Map<SocialChannelKey, SocialSnapshot>();
  for (const row of (data ?? []) as SocialSnapshot[]) {
    if (!byChannel.has(row.channel)) byChannel.set(row.channel, row);
  }
  return DISPLAYED_CHANNELS.map((channel) => ({
    channel,
    latest: byChannel.get(channel) ?? null,
  }));
}
