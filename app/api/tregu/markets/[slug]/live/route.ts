import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lmsrSportOutcomePrices } from "@/lib/tregu-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: market, error } = await supabase
    .from("markets")
    .select("id,slug,status,outcome,q_yes,q_no,b,market_type,market_classification,sport_outcomes,outcome_quantities,reference_probabilities,live_event,live_score_state,updated_at")
    .eq("slug", slug)
    .in("status", ["open", "closed", "resolved"])
    .maybeSingle();
  if (error || !market) return NextResponse.json({ error: "Tregu nuk u gjet" }, { status: 404, headers: { "Cache-Control": "no-store" } });

  const { data: snapshots } = await supabase
    .from("market_snapshots")
    .select("created_at,oracle_kind,reference_probability,market_prob,evidence")
    .eq("market_id", market.id)
    .order("created_at", { ascending: true })
    .limit(240);
  const probabilities = Array.isArray(market.sport_outcomes)
    ? lmsrSportOutcomePrices({ sport_outcomes: market.sport_outcomes, outcome_quantities: market.outcome_quantities, b: Number(market.b) })
    : {};
  const f1History = (snapshots ?? []).flatMap((snapshot) => {
    if (snapshot.oracle_kind !== "f1_vector" || !Array.isArray(snapshot.evidence)) return [];
    const evidence = snapshot.evidence[0] as { probabilities?: Record<string, number>; timing?: { race?: { current_lap?: number; status?: string } } } | undefined;
    return evidence?.probabilities
      ? [{ createdAt: snapshot.created_at, probabilities: evidence.probabilities, lap: evidence.timing?.race?.current_lap, status: evidence.timing?.race?.status }]
      : [];
  });
  return NextResponse.json({
    market: { ...market, market_prob: probabilities.home ?? probabilities.PO ?? null },
    probabilities,
    liveState: market.live_score_state ?? null,
    timing: market.live_score_state ?? null,
    snapshots: snapshots ?? [],
    f1History,
  }, { headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" } });
}
