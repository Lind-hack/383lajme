/**
 * OpenF1 authentication.
 *
 * OpenF1 is open to anonymous callers until a session is running, and then it
 * is not: while a practice, qualifying or race session is live it answers 401
 * to everyone unauthenticated, for every endpoint including historical ones —
 * "Global API access (including past sessions) is restricted to authenticated
 * users until the session ends." That is precisely the window the F1 markets
 * exist for, so without credentials the whole pipeline goes quiet exactly when
 * a race is on.
 *
 * The scheme is taken from OpenF1's own client (br-g/openf1,
 * src/openf1/util/openf1_client.py): an OAuth2 password grant against /token
 * exchanging OPENF1_CLIENT_ID and OPENF1_CLIENT_SECRET for a bearer token,
 * refreshed a minute before it expires.
 *
 * No credentials configured means anonymous requests, which is what every
 * caller did before this existed — so this is inert until the environment
 * carries a key, and a token endpoint that fails degrades to the same place
 * rather than taking the run down with it.
 */

const TOKEN_URL = "https://api.openf1.org/token";
const ANON = { Accept: "application/json" };

let cachedToken = null;
let expiresAt = 0;

/** Test seam: forget the cached token. */
export function resetOpenF1Token() {
  cachedToken = null;
  expiresAt = 0;
}

/** True when the environment carries OpenF1 credentials. */
export function openf1AuthConfigured(env = process.env) {
  return Boolean(env.OPENF1_CLIENT_ID && env.OPENF1_CLIENT_SECRET);
}

/**
 * Headers for an OpenF1 request — with a bearer token when credentials exist,
 * plain Accept when they do not.
 */
export async function openf1Headers({ fetchImpl = fetch, env = process.env, now = Date.now() } = {}) {
  const id = env.OPENF1_CLIENT_ID;
  const secret = env.OPENF1_CLIENT_SECRET;
  if (!id || !secret) return { ...ANON };

  if (!cachedToken || now >= expiresAt) {
    try {
      const response = await fetchImpl(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: id, password: secret }).toString(),
      });
      if (!response.ok) {
        cachedToken = null;
        expiresAt = 0;
        return { ...ANON };
      }
      const data = await response.json();
      const token = String(data?.access_token ?? "");
      const lifetime = Number(data?.expires_in);
      if (!token) {
        cachedToken = null;
        expiresAt = 0;
        return { ...ANON };
      }
      cachedToken = token;
      // A minute of headroom, matching OpenF1's own client.
      expiresAt = now + (Number.isFinite(lifetime) ? Math.max(60, lifetime) - 60 : 240) * 1000;
    } catch {
      cachedToken = null;
      expiresAt = 0;
      return { ...ANON };
    }
  }

  return { ...ANON, Authorization: `Bearer ${cachedToken}` };
}
