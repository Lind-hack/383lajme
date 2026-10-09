import { NextResponse } from "next/server";
import { TELEGRAM_CHANNEL_URL } from "@/lib/channels";
import { latestTelegramMessage } from "@/lib/telegram-preview.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const channel = new URL(TELEGRAM_CHANNEL_URL).pathname.slice(1);
    const response = await fetch(`https://t.me/s/${channel}`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("Channel unavailable");
    // Telegram's public page is normally ~120KB; cap streamed input before parsing.
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty response");
    const decoder = new TextDecoder();
    let html = "";
    let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 1_000_000) throw new Error("Response too large");
        html += decoder.decode(value, { stream: true });
      }
      html += decoder.decode();
    } finally {
      await reader.cancel();
    }
    return NextResponse.json({ message: latestTelegramMessage(html, channel) }, {
      headers: { "Cache-Control": "public, max-age=30" },
    });
  } catch {
    return NextResponse.json({ message: null }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
