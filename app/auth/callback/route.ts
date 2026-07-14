import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// A failed OAuth round-trip used to land on /?error=auth, and the homepage never
// read that param — so a provider rejecting the login looked exactly like a
// successful one that quietly didn't sign anyone in. Failures now carry their
// reason to /hyr, which shows it.
function fail(origin: string, reason: string) {
  return NextResponse.redirect(
    `${origin}/hyr?error=oauth&reason=${encodeURIComponent(reason.slice(0, 200))}`
  );
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  // Supabase forwards provider-side failures here as params instead of a code —
  // a Facebook account with no email attached is the common one.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) return fail(origin, providerError);

  const code = searchParams.get("code");

  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return fail(origin, error.message);
  }

  return fail(origin, "Ofruesi nuk ktheu asnjë kod.");
}
