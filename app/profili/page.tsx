import { redirect } from "next/navigation";
import Navbar from "@/components/navbar";
import { createClient } from "@/lib/supabase/server";
import { buildBalanceHistory } from "@/lib/profile-hub.mjs";
import ProfileHub from "./profile-hub";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/hyr?next=/profili");

  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, display_name, is_anonymous, coins, created_at, updated_at")
    .eq("id", user.id)
    .single();
  const profileNeedsMigration = Boolean(profileError);
  if (profileError) {
    const fallback = await supabase
      .from("profiles")
      .select("full_name, display_name, coins, created_at, updated_at")
      .eq("id", user.id)
      .single();
    profile = fallback.data ? { ...fallback.data, is_anonymous: false } : null;
    profileError = fallback.error;
  }

  const [savedResult, recentTransactionsResult, ledgerResult, positionsResult] =
    await Promise.all([
      supabase
        .from("saved_articles")
        .select("article_id, slug, title, excerpt, category, source, image_url, published_at, saved_at")
        .eq("user_id", user.id)
        .order("saved_at", { ascending: false }),
      supabase
        .from("transactions")
        .select("id, type, amount, created_at, market_id, meta, markets(question, slug)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("transactions")
        .select("amount, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1000),
      supabase
        .from("positions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gt("shares", 0),
    ]);

  const fullName = String(profile?.full_name || user.user_metadata?.full_name || "").trim();
  const displayName = String(profile?.display_name || fullName || user.email?.split("@")[0] || "Lexues 383").trim();
  const initials = (fullName || displayName || user.email || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word: string) => word[0]?.toUpperCase() ?? "")
    .join("");
  const coins = Number(profile?.coins ?? 0);

  return (
    <div className="profile-page-shell">
      <Navbar />
      <ProfileHub
        identity={{
          fullName,
          displayName,
          email: user.email ?? "",
          initials,
          anonymous: profile?.is_anonymous === true,
          joinedAt: user.created_at,
          lastSignInAt: user.last_sign_in_at ?? null,
          provider: String(user.app_metadata?.provider ?? "email"),
        }}
        savedArticles={(savedResult.data ?? []).map((item) => ({
          articleId: item.article_id,
          slug: item.slug,
          title: item.title,
          excerpt: item.excerpt,
          category: item.category,
          source: item.source,
          imageUrl: item.image_url,
          publishedAt: item.published_at,
          savedAt: item.saved_at,
        }))}
        tregu={{
          coins,
          activePositions: positionsResult.count ?? 0,
          history: buildBalanceHistory(ledgerResult.data ?? [], coins),
          transactions: (recentTransactionsResult.data ?? []).map((tx) => ({
            id: tx.id,
            type: tx.type,
            amount: Number(tx.amount),
            createdAt: tx.created_at,
            market: Array.isArray(tx.markets) ? tx.markets[0] ?? null : tx.markets,
          })),
        }}
        dataUnavailable={{
          savedArticles: Boolean(savedResult.error),
          tregu: Boolean(recentTransactionsResult.error || ledgerResult.error || positionsResult.error),
        }}
        profileUnavailable={profileNeedsMigration || Boolean(profileError)}
      />
    </div>
  );
}
