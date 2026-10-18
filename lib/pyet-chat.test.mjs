import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isSmallTalk,
  extractName,
  cleanName,
  buildChatPrompt,
  validateChat,
  cleanFollowups,
  CHAT_PROMPT,
} from "./pyet-chat.mjs";

test("greetings, thanks and questions about Dardani are small talk", () => {
  for (const m of [
    "Si je Dardan?",
    "Faleminderit, je shumë i mirë!",
    "Tung",
    "hi",
    "Ç'kemi",
    "Kush je ti?",
    "Më trego një shaka",
    "Mirëmëngjes Dardani!",
    "qysh je vlla",
    "Quhem Lind",
    "A je robot?",
  ]) {
    assert.equal(isSmallTalk(m), true, m);
  }
});

test("a message with a real subject goes to the archive, greeting or not", () => {
  for (const m of [
    "Çka ka të re sot në Kosovë?",
    "Pse ndodhi kjo?",
    "Tung, çka ndodhi me Kurtin?",
    "Kush është Albana Koçiu?",
    "Faleminderit për lajmin për Muriqin",
  ]) {
    assert.equal(isSmallTalk(m), false, m);
  }
});

test("the reader's name is picked up, and ordinary words are not names", () => {
  assert.equal(extractName("Quhem Lind"), "Lind");
  assert.equal(extractName("emri im është arta"), "Arta");
  assert.equal(extractName("Më thirr Lindi të lutem"), "Lindi");
  assert.equal(extractName("më thirr nesër"), null);
  assert.equal(extractName("Si je?"), null);
});

test("a name sent by the client is cleaned, not trusted", () => {
  assert.equal(cleanName("  lind<script> "), "Lindscript");
  assert.equal(cleanName("x"), null);
  assert.equal(cleanName(42), null);
  assert.equal(cleanName("a".repeat(60)).length, 24);
});

test("the chat prompt forbids news claims and carries who the reader is", () => {
  assert.ok(/Mos thuaj asgjë për ngjarje/.test(CHAT_PROMPT));
  const p = buildChatPrompt("Si je?", { name: "Lind", interests: ["Sport"], headlines: ["Titulli A"], today: "e shtunë" });
  assert.ok(p.includes("Emri i lexuesit: Lind"));
  assert.ok(p.includes("Lexuesi ndjek: Sport"));
  assert.ok(p.includes("- Titulli A"));
  assert.ok(p.endsWith("Si je?"));
});

test("chat replies are bounded", () => {
  assert.equal(validateChat(null).ok, false);
  assert.equal(validateChat({ answer: "" }).ok, false);
  assert.equal(validateChat({ answer: "x".repeat(700) }).ok, false);
  const ok = validateChat({ answer: "Mirë jam, faleminderit!", followups: ["Çka ka të re sot?", 3, "po"] });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.followups, ["Çka ka të re sot?"]);
});

test("follow-ups keep at most two short distinct questions", () => {
  assert.deepEqual(cleanFollowups(["Pse ndodhi?", "Pse ndodhi?", "Kush e tha?", "Sa kushtoi?"]), [
    "Pse ndodhi?",
    "Kush e tha?",
  ]);
  assert.deepEqual(cleanFollowups("jo"), []);
});
