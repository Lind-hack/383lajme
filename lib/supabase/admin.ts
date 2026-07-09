import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server-only, service-role client. Bypasses RLS — never import into a
// client component. Used by admin (ADMIN_SECRET-gated) and cron
// (CRON_SECRET-gated) routes to create/approve/resolve Tregu markets and
// write AI probability snapshots.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
