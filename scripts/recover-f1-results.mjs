import { createClient } from "@supabase/supabase-js";
import { fetchF1FinalResult, persistF1FinalResult } from "../lib/f1-result-recovery.mjs";

const slug = process.argv.find(a => a.startsWith("--slug="))?.slice(7);
if (!slug) throw new Error("Provide --slug=<exact market slug>; default is read-only. --apply persists the result.");
const apply = process.argv.includes("--apply");
const key = apply ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!key) throw new Error(apply ? "Service-role configuration is required to apply settlement" : "Supabase client configuration is required");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
const { data: market, error } = await admin.from("markets").select("*").eq("slug", slug).single();
if (error) throw new Error(error.message);
if (market.status === "resolved") { console.log(JSON.stringify({ slug, status: "already_resolved", winner: market.outcome })); process.exit(0); }
const result = await fetchF1FinalResult(market);
if (!result) throw new Error("No matching published final classification");
console.log(JSON.stringify({ slug, winner: result.winner, source: result.source_url, apply: process.argv.includes("--apply") }));
if (process.argv.includes("--apply")) {
  if (market.status === "open") await persistF1FinalResult(admin, market, result);
  else if (market.outcome !== result.winner) throw new Error("Closed market outcome does not match classification");
  const { error: settlementError } = await admin.rpc("settle_due_sport_markets");
  if (settlementError) throw new Error(settlementError.message);
  const { data: final } = await admin.from("markets").select("status,outcome").eq("id", market.id).single();
  console.log(JSON.stringify(final));
}
