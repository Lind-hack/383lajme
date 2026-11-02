import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server-only, service-role client. Bypasses RLS — never import into a
// client component. Used by admin (ADMIN_SECRET-gated) and cron
// (CRON_SECRET-gated) routes to create/approve/resolve Tregu markets and
// write AI probability snapshots.
//
// `actor` is sent as the x-dosje-actor header; the dosje change log (migration
// 0119) reads it from PostgREST's request.headers, so every dosje change
// records who made it ("admin", "dosje-daily").
export function createAdminClient(opts: { actor?: string } = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(opts.actor ? { global: { headers: { "x-dosje-actor": opts.actor } } } : {}),
  });
}
