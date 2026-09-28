import { graphSvg } from "./tregu-live-email-content.mjs";
import { marketNewsTaxonomy } from "./tregu-news-taxonomy.mjs";

const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const safeHttps = (value) => /^https:\/\/[^\s<>"']+$/i.test(String(value ?? "")) ? String(value) : null;
const emailImage = (value) => {
  const local = String(value ?? "");
  return safeHttps(value) ?? (/^\/api\/tregu\/market-art\/[a-z0-9%-]+$/i.test(local) ? `https://383lajme.vercel.app${local}` : null);
};
const ARCHETYPE_LABELS = {
  scheduled_decision: "Vendim i planifikuar", threshold: "Prag numerik",
  data_release: "Publikim të dhënash", policy_action: "Vendim politikash",
  appointment_or_selection: "Emërim ose përzgjedhje",
  escalation_or_deescalation: "Përshkallëzim ose ulje tensionesh",
  corporate_decision: "Vendim biznesi", executive_action: "Vendim ekzekutiv",
};
const CATEGORY_LABELS = { politike: "Politikë", ekonomi: "Ekonomi", bote: "Botë", "te-tjera": "Të tjera" };
const GEOGRAPHY_LABELS = { Kosovo: "Kosovë", Albania: "Shqipëri", World: "Botë" };
const NEWS_GEOGRAPHY_LABELS = { kosove: "Kosovë", shqiperi: "Shqipëri", bote: "Botë" };
const NEWS_TOPIC_LABELS = { politike: "Politikë", ekonomi: "Ekonomi", shoqeri: "Shoqëri", siguri: "Siguri", teknologji: "Teknologji", tjeter: "Të tjera" };

export function buildNewsMarketOpenEmail(market, openingSnapshot) {
  const probability = Number(openingSnapshot?.market_prob);
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) throw new Error("Persisted opening probability is required for creation email");
  const analysis = market.pre_match_analysis ?? {};
  const kind = ARCHETYPE_LABELS[analysis.market_archetype] ?? "Treg binar PO/JO";
  const geography = String(analysis.proposition?.geography ?? "").trim();
  const taxonomy = marketNewsTaxonomy(market);
  const categoryLabel = CATEGORY_LABELS[market.category] ?? String(market.category);
  const placeLabel = taxonomy.geography ? NEWS_GEOGRAPHY_LABELS[taxonomy.geography] : (GEOGRAPHY_LABELS[geography] ?? geography);
  const topicLabel = taxonomy.topic ? NEWS_TOPIC_LABELS[taxonomy.topic] : categoryLabel;
  const category = placeLabel ? `${placeLabel} · ${topicLabel}` : topicLabel;
  const link = `https://383lajme.vercel.app/tregu/${encodeURIComponent(String(market.slug))}`;
  const image = emailImage(market.market_image_url);
  const graph = graphSvg({ points: [{ timestamp: openingSnapshot.created_at, probability }] }, { "Market probability": "PO" });
  const imageHtml = image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(market.market_image_alt ?? market.question)}" width="640" style="display:block;width:100%;max-height:280px;object-fit:cover;border-radius:10px"/>` : "";
  const imageCredit = market.market_image_credit && safeHttps(market.market_image_source_url)
    ? `<p style="font-size:11px;color:#625e58"><a href="${escapeHtml(market.market_image_source_url)}" style="color:#625e58">${escapeHtml(market.market_image_credit)}</a></p>` : "";
  const text = `383 Tregu — treg i ri\n${market.question}\nLloji: ${kind}\nKategoria: ${category}\nOdds fillestare: PO ${(probability * 100).toFixed(2)}%, JO ${((1 - probability) * 100).toFixed(2)}%\nGrafiku: një pikë e regjistruar në ${openingSnapshot.created_at}\n${link}`;
  const html = `<!doctype html><html lang="sq"><body style="margin:0;padding:24px;background:#f9f6f1;font-family:Arial,sans-serif;color:#171513"><main style="max-width:680px;margin:auto;padding:24px;background:#fff;border:1px solid #e8e3db;border-radius:14px"><p style="font-size:12px;font-weight:800;color:#bf321a">383 TREGU · TREG I RI</p><h1 style="font-size:23px;line-height:1.25">${escapeHtml(market.question)}</h1>${imageHtml}${imageCredit}<p><strong>Lloji:</strong> ${escapeHtml(kind)}<br><strong>Kategoria:</strong> ${escapeHtml(category)}</p><p style="font-size:20px;font-weight:800;color:#087443">PO ${(probability * 100).toFixed(2)}% <span style="color:#625e58">· JO ${((1 - probability) * 100).toFixed(2)}%</span></p>${graph}<p style="font-size:12px;color:#625e58">Grafiku tregon vetëm pikën fillestare të ruajtur. Ai zgjerohet kur ndodhin tregtime ose përditësime të verifikuara.</p><a href="${escapeHtml(link)}" style="color:#b83019;font-weight:800">Hap tregun →</a></main></body></html>`;
  return { subject: `383 Tregu — ${market.question}`, text, html };
}
