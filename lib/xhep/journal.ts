/**
 * A visitor's experience cards, kept on their device until they choose to
 * send them to 383:
 *
 *   - the mural: up to 8 photos and selfies per city, in IndexedDB (too big
 *     for localStorage), each resized to at most 1600 px and re-encoded, so
 *     a 12 MB phone photo is stored as ~300 KB and its location metadata is
 *     dropped with the re-encode;
 *   - the story: the visitor's words about the city, in localStorage.
 *
 * Every call survives a browser that refuses storage (private mode, full
 * disk): reads come back empty, writes report false.
 */

export const MURAL_MAX = 8;
const MAX_EDGE = 1600;
const DB = "xhep";
const STORE = "mural";
const STORY_KEY = "xhep.story.v1";
const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif|avif)$/i;

export type MuralPhoto = { id: string; cityId: string; blob: Blob; width: number; height: number; addedAt: string };
export type PhotoError = "type" | "decode" | "full";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("city", "cityId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** The city's mural photos, oldest first; empty when storage is unavailable. */
export async function muralPhotos(cityId: string): Promise<MuralPhoto[]> {
  try {
    const db = await open();
    const all = await done(db.transaction(STORE).objectStore(STORE).index("city").getAll(cityId));
    db.close();
    return (all as MuralPhoto[]).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  } catch {
    return [];
  }
}

/** Resize and re-encode one picked photo; orientation from the camera is honoured. */
async function shrink(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  if (!ACCEPTED.test(file.type)) throw "type" satisfies PhotoError;
  let source: ImageBitmap;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw "decode" satisfies PhotoError;
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject("decode")), "image/jpeg", 0.85));
  return { blob, width: canvas.width, height: canvas.height };
}

/**
 * Add photos to a city's mural, up to MURAL_MAX. Returns what was added and
 * the first reason any file was skipped.
 */
export async function addMuralPhotos(cityId: string, files: File[]): Promise<{ added: number; error: PhotoError | null }> {
  const have = (await muralPhotos(cityId)).length;
  let error: PhotoError | null = null;
  let added = 0;
  const room = Math.max(0, MURAL_MAX - have);
  if (files.length > room) error = "full";
  for (const file of files.slice(0, room)) {
    try {
      const { blob, width, height } = await shrink(file);
      const photo: MuralPhoto = { id: `${cityId}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, cityId, blob, width, height, addedAt: new Date().toISOString() };
      const db = await open();
      await done(db.transaction(STORE, "readwrite").objectStore(STORE).put(photo));
      db.close();
      added++;
    } catch (reason) {
      error ??= reason === "type" || reason === "decode" ? reason : "decode";
    }
  }
  return { added, error };
}

export async function removeMuralPhoto(id: string): Promise<void> {
  try {
    const db = await open();
    await done(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
    db.close();
  } catch {
    // Nothing stored, nothing to remove.
  }
}

export type Story = { text: string; updatedAt: string | null };

function readStories(): Record<string, Story> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORY_KEY) ?? "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

/** The visitor's story for a city; empty when there is none. */
export function readStory(cityId: string): Story {
  const s = readStories()?.[cityId];
  return { text: typeof s?.text === "string" ? s.text.slice(0, 2000) : "", updatedAt: typeof s?.updatedAt === "string" ? s.updatedAt : null };
}

/** Keep the story (at most 2000 characters). False when storage refused. */
export function writeStory(cityId: string, text: string): boolean {
  try {
    const all = readStories();
    all[cityId] = { text: text.slice(0, 2000), updatedAt: new Date().toISOString() };
    localStorage.setItem(STORY_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}
