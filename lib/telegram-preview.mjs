import { toParagraphs } from "./article-body.mjs";

/** Extract the message div, including nested quote/formatting divs. */
function messageHtml(block) {
  const start = /<div\b[^>]*class="[^"]*\btgme_widget_message_text\b[^"]*"[^>]*>/i.exec(block);
  if (!start) return "";
  const offset = start.index + start[0].length;
  const tags = /<div\b[^>]*>|<\/div\s*>/gi;
  tags.lastIndex = offset;
  let depth = 1;
  for (let tag; (tag = tags.exec(block));) {
    depth += /^<\//.test(tag[0]) ? -1 : 1;
    if (depth === 0) return block.slice(offset, tag.index);
  }
  return "";
}

/** Read only actual messages belonging to the configured public channel. */
export function latestTelegramMessage(html, channel = "Lajmet383") {
  if (!/^[A-Za-z0-9_]+$/.test(channel)) return null;
  const blocks = String(html).split(/(?=<div\b[^>]*data-post=")/i);
  let latest = null;
  for (const block of blocks) {
    const post = /data-post="([A-Za-z0-9_]+)\/(\d+)"/.exec(block);
    if (!post || post[1].toLowerCase() !== channel.toLowerCase()) continue;
    const messageId = Number(post[2]);
    const content = messageHtml(block);
    const text = toParagraphs(content.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")).join("\n\n");
    const timestamp = /<time\b[^>]*datetime="([^"]+)"/.exec(block)?.[1];
    if (!Number.isSafeInteger(messageId) || !text || !timestamp || !Number.isFinite(Date.parse(timestamp))) continue;
    if (latest && messageId <= latest.messageId) continue;
    const articleUrl = [...content.matchAll(/<a\b[^>]*href="(https:\/\/(?:www\.)?383ks\.com\/(?:a\/[a-z0-9]+|article\/[a-z0-9-]+))"/gi)][0]?.[1] ?? null;
    latest = { messageId, text, url: `https://t.me/${channel}/${messageId}`, publishedAt: new Date(timestamp).toISOString(), articleUrl };
  }
  return latest;
}
