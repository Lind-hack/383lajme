export function authPublicOrigin(requestUrl: URL, configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL) {
  const configured = configuredSiteUrl?.trim();

  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      // Fall back to the request origin when configuration is malformed.
    }
  }

  return requestUrl.origin;
}
