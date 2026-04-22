'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        window.location.href = '/admin/login';
      }}
      disabled={busy}
      className="text-[13px] px-3 py-1.5 rounded-md border transition"
      style={{ color: 'var(--muted)', borderColor: 'var(--rule)' }}
    >
      {busy ? '...' : 'خروج'}
    </button>
  );
}
