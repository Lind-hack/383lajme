import { createPrivateKey, sign, type JsonWebKey } from "node:crypto";

/**
 * Web Push without a library, and without a payload.
 *
 * A push with no body needs no message encryption: it only wakes the service
 * worker (public/tregu-sw.js), which then fetches the newest event for the
 * signed-in user and shows it. What the push service does need is a VAPID
 * token: an ES256 JWT naming our origin, signed with the key pair stored in
 * tregu_app_secrets (service-role only, never in the repo).
 */

export type VapidKeys = { publicKey: string; privateJwk: JsonWebKey };

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

function vapidToken(endpoint: string, keys: VapidKeys, subject: string) {
  const audience = new URL(endpoint).origin;
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64url(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const unsigned = `${header}.${claims}`;
  const key = createPrivateKey({ key: keys.privateJwk, format: "jwk" });
  // ieee-p1363: the raw r||s signature JWS expects, not DER.
  const signature = sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" });
  return `${unsigned}.${b64url(signature)}`;
}

/** Wake one subscription. Resolves "gone" when the browser has unsubscribed. */
export async function sendEmptyPush(endpoint: string, keys: VapidKeys, subject = "mailto:info@383media.com") {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      TTL: String(6 * 3600),
      Urgency: "high",
      Authorization: `vapid t=${vapidToken(endpoint, keys, subject)}, k=${keys.publicKey}`,
      "Content-Length": "0",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 404 || response.status === 410) return "gone" as const;
  if (!response.ok) throw new Error(`push ${response.status}`);
  return "sent" as const;
}
