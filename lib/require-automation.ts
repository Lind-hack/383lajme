import { NextResponse, type NextRequest } from "next/server";
import { automationSecret, isAutomationAuthorized } from "./tregu-automation.mjs";

/**
 * The single gate for machine-to-machine routes.
 *
 * Eleven routes repeated the same stanza in three variants (single secret,
 * either-secret array, private `authorized()` wrapper) — two copies of an
 * auth rule being exactly how the old admin cookie check drifted out of sync
 * (see app/api/admin/articles/route.ts). This is the one copy now.
 *
 * Either secret opens a route. automationSecret() prefers
 * TREGU_AUTOMATION_SECRET, but the GitHub Actions runner holds CRON_SECRET
 * and nothing guarantees the two values match — accepting only the preferred
 * one turns a mismatch into an unexplained 401 on a nightly job (the failure
 * sondazhi/draft already worked around inline).
 */

/** Every secret that opens an automation route, deduplicated. */
export function automationSecrets(): string[] {
  return [...new Set([automationSecret(), process.env.CRON_SECRET ?? ""].filter(Boolean))];
}

export function isAutomationRequest(request: NextRequest): boolean {
  const header = request.headers.get("authorization") ?? "";
  return automationSecrets().some((secret) => isAutomationAuthorized(header, secret));
}

/**
 * Null when the request is authorized; the error response otherwise.
 * 500 when no secret is configured (operator misconfiguration, not a caller
 * problem), 401 for a wrong or missing credential.
 */
export function automationDenied(request: NextRequest): NextResponse | null {
  if (automationSecrets().length === 0) {
    return NextResponse.json(
      { error: "TREGU_AUTOMATION_SECRET or CRON_SECRET is required." },
      { status: 500 },
    );
  }
  if (!isAutomationRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
