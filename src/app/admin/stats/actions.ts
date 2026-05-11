'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { requireTeamPage } from '@/lib/admin-guard';

const TAGS = [
  'stats:newsletter',
  'stats:github',
  // analytics/forum/quran-apps/cms aren't tagged because they're either
  // SDK calls (GA) or direct DB queries (Postgres/MySQL) — Next's fetch
  // cache doesn't apply, so revalidating their tags is a no-op. The
  // page's own revalidatePath below covers them by re-running the
  // server component.
] as const;

export async function refreshStats(): Promise<void> {
  // Auth — revalidating cache shouldn't be triggerable by anonymous users.
  await requireTeamPage();
  for (const tag of TAGS) {
    revalidateTag(tag);
  }
  revalidatePath('/admin/stats');
}
