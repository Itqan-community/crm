import { createClient } from '@supabase/supabase-js';

// Service-role client. Bypasses RLS — only use in trusted server contexts
// (API routes, server actions). Never expose this client to the browser.
export function createSupabaseAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. See .env.example.');
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
