// Server only. Makes the day's clay cover plates (lib/cover-art.mjs) and reads
// them back for the pages.
//
// runCoverArt runs from the two-minute heartbeat (runLiveSportsAutomation in
// lib/tregu-automation-server.ts). Most runs do nothing: it makes at most
// PER_RUN plates, at most every RUN_EVERY_MS, at most MAX_PER_DAY a Kosovo day.
// For each chosen story it fetches the story's own photo, shrinks it under the
// model's 512 px input limit, asks Cloudflare Workers AI (FLUX.2 klein 4B) to
// restyle it, re-encodes the result as WebP and puts it in the public
// perty-cover-art bucket, then rewrites index.json beside it. It never throws:
// a failed plate is skipped and tried again on a later run.
//
// Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (CLOUDFLARETOKEN is
// accepted too, the name the automation repo's .env uses). Without them it
// does nothing.

import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { getArticlesBefore } from "@/lib/db";
import { kosovoDateKey } from "@/lib/home-tregu.mjs";
import {
  COVER_BUCKET,
  INDEX_PATH,
  coverArtMap,
  coverPrompt,
  normalizeIndex,
  pickCoverStories,
  platePath,
  runBudget,
  withPlates,
} from "@/lib/cover-art.mjs";

const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
/** The model refuses input images of 512 px or more. */
const INPUT_PX = 500;
const PHOTO_TIMEOUT_MS = 8_000;
const MODEL_TIMEOUT_MS = 30_000;

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

function cloudflare() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARETOKEN;
  return account && token ? { account, token } : null;
}

function publicBase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? `${url}/storage/v1/object/public/${COVER_BUCKET}` : "";
}

async function readIndex(admin: Admin) {
  const { data, error } = await admin.storage.from(COVER_BUCKET).download(INDEX_PATH);
  if (error || !data) return { index: normalizeIndex(null), missing: true };
  try {
    return { index: normalizeIndex(JSON.parse(await data.text())), missing: false };
  } catch {
    return { index: normalizeIndex(null), missing: false };
  }
}

async function writeIndex(admin: Admin, index: unknown) {
  const body = Buffer.from(JSON.stringify(index));
  await admin.storage
    .from(COVER_BUCKET)
    .upload(INDEX_PATH, body, { contentType: "application/json", upsert: true, cacheControl: "60" });
}

/** The bucket, created public on first use. */
async function ensureBucket(admin: Admin) {
  const { data } = await admin.storage.getBucket(COVER_BUCKET);
  if (data) return;
  await admin.storage.createBucket(COVER_BUCKET, { public: true, fileSizeLimit: "2MB", allowedMimeTypes: ["image/webp", "application/json"] });
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** One plate: the story's photo in, a WebP of its clay version out. */
async function makePlate(cf: { account: string; token: string }, article: { title?: string; excerpt?: string; imageUrl?: string }) {
  const photo = await fetchWithTimeout(article.imageUrl as string, { headers: { "User-Agent": "383ks.com cover art" } }, PHOTO_TIMEOUT_MS);
  if (!photo.ok) throw new Error(`photo ${photo.status}`);
  const small = await sharp(Buffer.from(await photo.arrayBuffer()))
    .rotate()
    .resize(INPUT_PX, INPUT_PX, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();

  const form = new FormData();
  form.append("prompt", coverPrompt(article));
  form.append("input_image_0", new Blob([new Uint8Array(small)], { type: "image/png" }), "photo.png");
  // The cover's frame is landscape on a desktop and cropped on a phone.
  form.append("width", "1024");
  form.append("height", "768");
  const res = await fetchWithTimeout(
    `https://api.cloudflare.com/client/v4/accounts/${cf.account}/ai/run/${MODEL}`,
    { method: "POST", headers: { Authorization: `Bearer ${cf.token}` }, body: form },
    MODEL_TIMEOUT_MS
  );
  const json = (await res.json().catch(() => null)) as { result?: { image?: string }; errors?: unknown } | null;
  const image = json?.result?.image;
  if (!res.ok || typeof image !== "string") throw new Error(`model ${res.status} ${JSON.stringify(json?.errors ?? "")}`);
  return sharp(Buffer.from(image, "base64")).webp({ quality: 80 }).toBuffer();
}

export async function runCoverArt(now = new Date()) {
  try {
    const cf = cloudflare();
    if (!cf) return { skipped: "no-cloudflare-keys" };
    const admin = createAdminClient();
    if (!admin) return { skipped: "no-admin" };

    const today = kosovoDateKey(now);
    let { index, missing } = await readIndex(admin);
    const budget = runBudget(index, today, now.getTime());
    if (budget === 0) return { skipped: "not-due" };
    if (missing) await ensureBucket(admin);

    // The newest stories, as Për ty's own pool is built: getArticles() puts
    // featured and most-engaged first, and its top rows are mostly older than
    // FRESH_MS, so it chose nothing. pickCoverStories ranks these by engagement.
    const recent = await getArticlesBefore({ limit: 120 });
    const chosen = pickCoverStories(recent, index, { now: now.getTime(), max: budget });
    const plates: { slug: string; path: string }[] = [];
    const failed: string[] = [];
    for (const article of chosen) {
      try {
        const webp = await makePlate(cf, article);
        const path = platePath(today, article.slug);
        const { error } = await admin.storage
          .from(COVER_BUCKET)
          .upload(path, webp, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
        if (error) throw new Error(error.message);
        plates.push({ slug: article.slug, path });
      } catch (error) {
        failed.push(`${article.slug}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    // Stamped even when nothing was made, so a failing source waits a whole
    // interval instead of being retried every two minutes.
    index = withPlates(index, today, plates, now.getTime());
    await writeIndex(admin, index);
    if (failed.length) console.error("Cover art:", failed.join("; "));
    return { considered: recent.length, chosen: chosen.length, made: plates.length, failed: failed.length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** slug → plate URL, for the pages. Cached by Next for ten minutes; {} when anything is off. */
export async function getCoverArtMap(): Promise<Record<string, string>> {
  const base = publicBase();
  if (!base) return {};
  try {
    const res = await fetch(`${base}/${INDEX_PATH}`, { next: { revalidate: 600 } });
    if (!res.ok) return {};
    return coverArtMap(await res.json(), base);
  } catch {
    return {};
  }
}
