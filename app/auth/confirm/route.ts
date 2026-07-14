import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Email links land here, not on /auth/callback.
//
// The @supabase/ssr client signs up over PKCE, but Supabase's stock
// {{ .ConfirmationURL }} is an implicit-flow link: it bounces through
// /auth/v1/verify and hands the session back in the URL *fragment*. Fragments
// are never sent to the server, so the route handler saw no code, set no
// cookie, and the user landed back on the site signed out.
//
// {{ .TokenHash }} + verifyOtp is the server-side flow: the token arrives as a
// query param, gets exchanged here, and the session cookie is written before
// the redirect. It also survives the user opening the mail on a different
// device than they signed up on, which PKCE code exchange cannot.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Expired or already-used link — send them back to sign-in with a reason,
  // not to a homepage that silently pretends nothing happened.
  return NextResponse.redirect(`${origin}/hyr?error=confirm`);
}
