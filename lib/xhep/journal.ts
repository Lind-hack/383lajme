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
/** Fired after the mural changes, so cards showing it redraw. */
export const PROFILE_JOURNAL_EVENT = "xhep:journal";
function announce() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PROFILE_JOURNAL_EVENT));
}
const MAX_EDGE = 1600;
const DB = "xhep";
const STORE = "mural";
const STORY_KEY = "xhep.story.v1";

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

// Photos kept for this page visit when the browser refuses IndexedDB (some
// private modes), so adding a photo never silently does nothing.
const memory: MuralPhoto[] = [];

/** The city's mural photos, oldest first. */
export async function muralPhotos(cityId: string): Promise<MuralPhoto[]> {
  let stored: MuralPhoto[] = [];
  try {
    const db = await open();
    stored = (await done(db.transaction(STORE).objectStore(STORE).index("city").getAll(cityId))) as MuralPhoto[];
    db.close();
  } catch {
    // Storage unavailable: only this visit's photos.
  }
  return [...stored, ...memory.filter((p) => p.cityId === cityId)].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

/**
 * Decode a picked photo whatever the browser calls it. Some Safari versions
 * reject createImageBitmap's orientation option outright, Chrome can't read
 * HEIC, and Windows often reports no type at all — so try the plain bitmap,
 * then an <img> (which reads HEIC on Safari and applies camera orientation).
 */
async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number; close?: () => void }> {
  try {
    return await createImageBitmap(file);
  } catch {
    // Fall through to the image element.
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Resize and re-encode one picked photo (dropping its location metadata). */
async function shrink(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  if (file.type && !/^image\//i.test(file.type) && !/\.(heic|heif|jpe?g|png|webp|avif|gif)$/i.test(file.name)) throw "type" satisfies PhotoError;
  let source: Awaited<ReturnType<typeof decode>>;
  try {
    source = await decode(file);
  } catch {
    throw "decode" satisfies PhotoError;
  }
  if (!source.width || !source.height) throw "decode" satisfies PhotoError;
  const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();
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
    let photo: MuralPhoto;
    try {
      const { blob, width, height } = await shrink(file);
      photo = { id: `${cityId}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, cityId, blob, width, height, addedAt: new Date().toISOString() };
    } catch (reason) {
      error ??= reason === "type" ? "type" : "decode";
      continue;
    }
    try {
      const db = await open();
      await done(db.transaction(STORE, "readwrite").objectStore(STORE).put(photo));
      db.close();
    } catch {
      memory.push(photo);
    }
    added++;
    announce();
  }
  return { added, error };
}

export async function removeMuralPhoto(id: string): Promise<void> {
  try {
    const db = await open();
    await done(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
    db.close();
  } catch {
    // Not in storage; it may be a this-visit photo.
  }
  const i = memory.findIndex((p) => p.id === id);
  if (i >= 0) memory.splice(i, 1);
  announce();
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
