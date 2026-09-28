import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";
import { LEAGUE_SCOPES, PUBLIC_LEAGUE_FEE, publicLeaguePrizes } from "@/lib/tregu-leagues";

export const dynamic = "force-dynamic";

const PROFILE_FIELDS = ["description", "rules", "emblem", "color", "cover_url", "sponsor"] as const;
type Profile = Partial<Record<(typeof PROFILE_FIELDS)[number], string | null>>;

/** Trim each optional profile field to null-or-text within the table's limits. */
function readProfile(body: Record<string, unknown>): Profile | string {
  const limits = { description: 280, rules: 1200, emblem: 500, color: 7, cover_url: 500, sponsor: 120 };
  const profile: Profile = {};
  for (const field of PROFILE_FIELDS) {
    if (!(field in body)) continue;
    const raw = body[field];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value.length > limits[field]) return `${field} është shumë i gjatë.`;
    profile[field] = value || null;
  }
  if (profile.color && !/^#[0-9A-Fa-f]{6}$/.test(profile.color)) return "Ngjyra duhet të jetë si #FF4422.";
  return profile;
}

function scopeFrom(body: Record<string, unknown>) {
  const kind = String(body.scope_kind ?? "all");
  const value = body.scope_value == null || body.scope_value === "" ? null : String(body.scope_value);
  return LEAGUE_SCOPES.find((scope) => scope.kind === kind && scope.value === value) ?? null;
}

async function guard(request: NextRequest) {
  if (!(await isAdminAuthed(request))) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = createAdminClient();
  if (!admin) return { error: NextResponse.json({ error: "Supabase not configured" }, { status: 500 }) };
  return { admin };
}

/** Public leagues, newest first, with member counts and pots. */
export async function GET(request: NextRequest) {
  const { admin, error } = await guard(request);
  if (!admin) return error;

  const { data, error: queryError } = await admin
    .from("tregu_leagues")
    .select("id, name, starts_at, ends_at, prizes, entry_fee, settled_at, description, rules, emblem, color, cover_url, sponsor, scope_kind, scope_value, featured, feature_order, tregu_league_members(fee_paid)")
    .eq("kind", "public")
    .order("ends_at", { ascending: false })
    .limit(80);
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });

  const leagues = (data ?? []).map(({ tregu_league_members, ...league }) => {
    const members = (tregu_league_members as unknown as { fee_paid: number }[] | null) ?? [];
    return { ...league, members: members.length, pot: members.reduce((sum, member) => sum + Number(member.fee_paid || 0), 0) };
  });
  return NextResponse.json({ leagues });
}

/**
 * POST { name, starts_at, ends_at, scope_kind, scope_value, ...profile }
 *   → one public league.
 * POST { bulk: true, starts_at, ends_at }
 *   → one public league per theme (Kosovë, Champions League, F1…), each with
 *     its theme's emblem and colour. Themes that already have a league
 *     overlapping this window are skipped.
 *
 * Prizes are not chosen here: 383 pays 75% of the leaderboard prize for the
 * league's length (publicLeaguePrizes), and the entry fee is always 10.
 */
export async function POST(request: NextRequest) {
  const { admin, error } = await guard(request);
  if (!admin) return error;

  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const startsAt = new Date(String(body.starts_at ?? ""));
  const endsAt = new Date(String(body.ends_at ?? ""));
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return NextResponse.json({ error: "Datat nuk vlejnë: mbarimi duhet të jetë pas fillimit." }, { status: 400 });
  }
  if (endsAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Liga duhet të mbarojë në të ardhmen." }, { status: 400 });
  }
  const days = Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / 86_400_000));
  const prizes = publicLeaguePrizes(days);
  const common = {
    kind: "public",
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    prizes,
    entry_fee: PUBLIC_LEAGUE_FEE,
    max_members: 500,
  };

  if (body.bulk === true) {
    const { data: existing } = await admin
      .from("tregu_leagues")
      .select("scope_kind, scope_value")
      .eq("kind", "public")
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", startsAt.toISOString());
    const taken = new Set((existing ?? []).map((row) => `${row.scope_kind}:${row.scope_value ?? ""}`));
    const suffix = days <= 7 ? "e Javës" : "e Muajit";
    const rows = LEAGUE_SCOPES.filter((scope) => !taken.has(`${scope.kind}:${scope.value ?? ""}`)).map((scope) => ({
      ...common,
      name: scope.kind === "all" ? `Liga ${suffix}` : `${scope.label} · Liga ${suffix}`.slice(0, 40),
      scope_kind: scope.kind,
      scope_value: scope.value,
      emblem: scope.emblem,
      color: scope.color,
      description: scope.kind === "all" ? "Çdo treg numërohet." : `Numërohen vetëm tregtitë në ${scope.label}.`,
    }));
    if (!rows.length) return NextResponse.json({ created: 0 });
    const { error: insertError } = await admin.from("tregu_leagues").insert(rows);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
    return NextResponse.json({ created: rows.length });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 3 || name.length > 40) {
    return NextResponse.json({ error: "Emri duhet të ketë 3 deri në 40 shkronja." }, { status: 400 });
  }
  const scope = scopeFrom(body);
  if (!scope) return NextResponse.json({ error: "Tema e ligës nuk vlen." }, { status: 400 });
  const profile = readProfile(body);
  if (typeof profile === "string") return NextResponse.json({ error: profile }, { status: 400 });

  const { data, error: insertError } = await admin
    .from("tregu_leagues")
    .insert({
      ...common,
      name,
      scope_kind: scope.kind,
      scope_value: scope.value,
      emblem: profile.emblem ?? scope.emblem,
      color: profile.color ?? scope.color,
      description: profile.description ?? null,
      rules: profile.rules ?? null,
      cover_url: profile.cover_url ?? null,
      sponsor: profile.sponsor ?? null,
    })
    .select("id")
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  return NextResponse.json({ id: data.id });
}

/** PATCH { id, name?, featured?, feature_order?, ...profile } — edit a public
 *  league's profile or its place on the Tregu home card. Money and dates are
 *  not editable once people may have joined on them. */
export async function PATCH(request: NextRequest) {
  const { admin, error } = await guard(request);
  if (!admin) return error;

  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Liga mungon." }, { status: 400 });
  const profile = readProfile(body);
  if (typeof profile === "string") return NextResponse.json({ error: profile }, { status: 400 });
  const update: Record<string, unknown> = { ...profile };
  if (typeof body.featured === "boolean") update.featured = body.featured;
  if (body.feature_order != null) {
    const order = Math.round(Number(body.feature_order));
    if (!Number.isFinite(order) || order < 0 || order > 99) return NextResponse.json({ error: "Renditja duhet të jetë 0 deri në 99." }, { status: 400 });
    update.feature_order = order;
  }
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name.length < 3 || name.length > 40) return NextResponse.json({ error: "Emri duhet të ketë 3 deri në 40 shkronja." }, { status: 400 });
    update.name = name;
  }
  const { error: updateError } = await admin.from("tregu_leagues").update(update).eq("id", id).eq("kind", "public");
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
