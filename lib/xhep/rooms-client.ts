"use client";

// The trip rooms this device belongs to, kept in localStorage (the token is
// the device's proof of membership), and the calls to app/api/xhep/rooms.

import { ROOM_CODE_RE } from "./rooms.mjs";

export const ROOMS_KEY = "xhep.rooms.v1";
export const ROOMS_EVENT = "xhep:rooms";
export const roomUrl = (code: string, lang: "en" | "sq" = "sq") => `https://383ks.com/visit/r/${code}?lang=${lang}`;

export type MyRoom = { code: string; name: string; memberId: string; token: string };
export type Progress = { opened: string[]; painted: string[]; cities: Record<string, number>; stamps: number };
export type RoomMember = { id: string; name: string; colour: string; progress: Progress; score: number; updatedAt: string };
export type RoomMoment = { id: string; memberId: string; kind: "moment" | "pack" | "complete" | "join"; cityId: string | null; body: string; createdAt: string };
export type RoomView = { room: { code: string; name: string; createdAt: string }; members: RoomMember[]; moments: RoomMoment[] };

/** Stored rooms, each checked: data written by an older version may not match. */
export function myRooms(): MyRoom[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(ROOMS_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (r) => typeof r?.code === "string" && ROOM_CODE_RE.test(r.code) && typeof r?.token === "string" && typeof r?.memberId === "string",
    ).map((r) => ({ code: r.code, name: typeof r?.name === "string" ? r.name : r.code, memberId: r.memberId, token: r.token }));
  } catch {
    return [];
  }
}

function save(rooms: MyRoom[]) {
  try {
    window.localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  } catch {}
  window.dispatchEvent(new Event(ROOMS_EVENT));
}

export function rememberRoom(room: MyRoom) {
  save([room, ...myRooms().filter((r) => r.code !== room.code)]);
}

export function forgetRoom(code: string) {
  save(myRooms().filter((r) => r.code !== code));
}

async function call<T>(url: string, body?: object): Promise<T & { ok: boolean; code?: string }> {
  const response = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  try {
    return await response.json();
  } catch {
    return { ok: false, code: "failed" } as T & { ok: boolean; code?: string };
  }
}

export async function createRoom(roomName: string, displayName: string, progress: Progress) {
  const r = await call<{ code: string; roomName: string; memberId: string; token: string }>("/api/xhep/rooms", { roomName, displayName, progress });
  if (r.ok) rememberRoom({ code: r.code, name: r.roomName, memberId: r.memberId, token: r.token });
  return r;
}

export async function joinRoom(code: string, name: string, displayName: string, progress: Progress) {
  const r = await call<{ memberId: string; token: string }>(`/api/xhep/rooms/${code}`, { action: "join", displayName, progress });
  if (r.ok) rememberRoom({ code, name, memberId: r.memberId, token: r.token });
  return r;
}

export const fetchRoom = (code: string) => call<RoomView>(`/api/xhep/rooms/${code}`);

export const postMoment = (room: MyRoom, body: string, cityId: string | null) =>
  call(`/api/xhep/rooms/${room.code}`, { action: "moment", token: room.token, body, cityId });

export async function leaveRoom(room: MyRoom) {
  const r = await call(`/api/xhep/rooms/${room.code}`, { action: "leave", token: room.token });
  forgetRoom(room.code);
  return r;
}

/** Send this device's progress to every room it is in; skipped when nothing changed. */
export async function syncProgress(progress: Progress) {
  const key = JSON.stringify(progress);
  for (const room of myRooms()) {
    const sentKey = `xhep.rooms.sent.${room.code}`;
    try {
      if (window.sessionStorage.getItem(sentKey) === key) continue;
    } catch {}
    const r = await call(`/api/xhep/rooms/${room.code}`, { action: "progress", token: room.token, progress });
    // The room is gone or this device was removed: forget it.
    if (!r.ok && (r.code === "not_found" || r.code === "not_member")) forgetRoom(room.code);
    else if (r.ok) {
      try {
        window.sessionStorage.setItem(sentKey, key);
      } catch {}
    }
  }
}
