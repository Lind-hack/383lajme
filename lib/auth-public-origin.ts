export function authPublicOrigin(requestUrl: URL, configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL, publicHost?: string | null) {
  const configured = configuredSiteUrl?.trim();

  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.protocol === "http:") {
        // Keep host-only session/PKCE cookies on the original public hostname.
        // Only the configured host and its www alias may override the origin.
        for (const host of [publicHost, requestUrl.host]) {
          if (!host) continue;
          try {
            const candidate = new URL(`${url.protocol}//${host}`);
            if (!candidate.username && !candidate.password && candidate.port === url.port &&
                candidate.hostname.replace(/^www\./, "") === url.hostname.replace(/^www\./, "")) return candidate.origin;
          } catch { /* Untrusted or malformed host: retain the configured origin. */ }
        }
        return url.origin;
      }
    } catch {
      // Fall back to the request origin when configuration is malformed.
    }
  }

  return requestUrl.origin;
}
