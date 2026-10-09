import test from "node:test";
import assert from "node:assert/strict";
import { latestTelegramMessage } from "./telegram-preview.mjs";

const post = (id, content, channel = "Lajmet383", date = "2026-10-09T20:00:00+00:00") => `<div class="tgme_widget_message" data-post="${channel}/${id}"><div class="tgme_widget_message_text js-message_text">${content}</div><time datetime="${date}"></time></div>`;

test("latest preview is the newest channel message, not the newest article or first message", () => {
  const result = latestTelegramMessage(post(14, "Newer") + post(12, "Older") + post(99, "Foreign", "OtherChannel"));
  assert.equal(result.messageId, 14);
  assert.equal(result.text, "Newer");
  assert.equal(result.url, "https://t.me/Lajmet383/14");
  assert.equal(result.publishedAt, "2026-10-09T20:00:00.000Z");
});

test("plain text retains paragraphs and nested quotes without rendering external HTML", () => {
  const result = latestTelegramMessage(post(2, '<b>Title &amp; news</b><br/><br/><div>Quoted &quot;words&quot;</div><script>alert(1)</script><br/>Lexo më shumë: <a href="https://383ks.com/a/0b0lhuq">https://383ks.com/a/0b0lhuq</a>'));
  assert.equal(result.text, 'Title & news\n\nQuoted "words"\n\nLexo më shumë: https://383ks.com/a/0b0lhuq');
  assert.equal(result.articleUrl, "https://383ks.com/a/0b0lhuq");
});

test("rejects arbitrary article destinations and malformed message records", () => {
  assert.equal(latestTelegramMessage(post(2, '<a href="https://evil.example/article/a">Link</a>')).articleUrl, null);
  assert.equal(latestTelegramMessage(post(2, "Broken date", "Lajmet383", "bad")), null);
  assert.equal(latestTelegramMessage(post(2, "", "Lajmet383")), null);
  assert.equal(latestTelegramMessage("<html>No messages</html>"), null);
  assert.equal(latestTelegramMessage(post(2, "Title"), "../bad"), null);
});

test("edited older posts and service-only posts do not replace the latest text message", () => {
  const result = latestTelegramMessage(post(3, "Latest text") + post(2, "Older edited", "Lajmet383", "2026-10-10T20:00:00Z") + '<div data-post="Lajmet383/4"><time datetime="2026-10-09T20:00:00Z"></time></div>');
  assert.equal(result.messageId, 3);
});
