import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss from "postcss";

const sheet = (path) => postcss.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
function declarations(css, selector) {
  const values = {};
  css.walkRules((rule) => {
    if (rule.selector === selector) rule.walkDecls((decl) => { values[decl.prop] = decl.value; });
  });
  assert.ok(Object.keys(values).length, `Missing palette: ${selector}`);
  return values;
}
const themeCss = sheet("app/site-theme.css");
const theme = declarations(themeCss, 'html[data-theme="dark"]');
function resolve(value, variables) {
  while (value.includes("var(")) {
    value = value.replace(/var\((--[\w-]+)(?:,\s*([^()]+))?\)/g, (_, name, fallback) => variables[name] ?? fallback ?? "");
  }
  return value;
}
function rgb(value, variables = theme, under = [21, 21, 19]) {
  value = resolve(value, variables);
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16));
  }
  const channels = value.match(/[\d.]+/g)?.map(Number);
  assert.ok(channels?.length >= 3, `Unsupported colour: ${value}`);
  const alpha = channels[3] ?? 1;
  return channels.slice(0, 3).map((c, i) => c * alpha + under[i] * (1 - alpha));
}
function contrast(foreground, background, variables = theme, threshold = 4.5) {
  const bg = rgb(background, variables);
  const fg = rgb(foreground, variables, bg);
  const luminance = (channels) => channels.map((c) => {
    c /= 255;
    return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
  }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  const a = luminance(fg), b = luminance(bg);
  const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  assert.ok(ratio >= threshold, `${foreground} on ${background}: ${ratio.toFixed(2)} < ${threshold}`);
}

test("Tregu glass, including the stronger stats panel, carries readable dark-mode text", () => {
  const palette = { ...theme, ...declarations(themeCss, 'html[data-theme="dark"] .tregu-scope') };
  for (const panel of ["--tg-panel", "--tg-panel-hi"]) {
    contrast(palette["--tg-text"], palette[panel], palette);
    contrast(palette["--tg-muted"], palette[panel], palette);
  }
});

test("league secondary text remains readable at both ends of its dark paper gradient", () => {
  const css = sheet("components/tregu/leagues.css");
  const palette = { ...theme, ...declarations(css, 'html[data-theme="dark"] :is(.lgc, .lgs, .lgp, .lgx, .lbp, .lgb, .lgb-list, .duel-sheet, .lgh, .rrm, .lgj, .ptx, .rrv)') };
  for (const paper of ["--theme-paper", "--lg-paper-2"]) {
    for (const ink of ["--lg-ink", "--lg-ink-2", "--lg-ink-3"]) contrast(palette[ink], palette[paper], palette);
  }
});

test("metal podiums retain dark labels on their bright surfaces in either site theme", () => {
  const css = sheet("components/tregu/leagues.css");
  for (const selector of [".podium-step b", ".podium-step small", ".pool-places b", ".pool-places small"]) {
    const label = declarations(css, selector);
    for (const rank of [1, 2, 3]) {
      const palette = { ...theme, ...declarations(css, `.podium-seat[data-place="${rank}"]`) };
      contrast(label.color, palette["--metal"], palette, selector.endsWith(" b") ? 3 : 4.5);
      contrast(label.color, palette["--metal-hi"], palette, selector.endsWith(" b") ? 3 : 4.5);
    }
  }
});

test("semantic status text is readable on both dark site surfaces", () => {
  for (const ink of ["--theme-muted", "--theme-accent-ink", "--theme-positive-ink", "--theme-negative-ink", "--theme-warning-ink"]) {
    for (const bg of ["--theme-paper", "--theme-surface"]) contrast(theme[ink], theme[bg]);
  }
});

test("visitor actions and comment fields resolve matching foreground and surface roles", () => {
  const visitor = sheet("components/visit/border-card.module.css");
  contrast(declarations(visitor, ".secondary").color, theme["--theme-surface"]);
  contrast(declarations(visitor, ".card").color, theme["--theme-paper"]);
  const comments = declarations(sheet("components/comments/comments.css"), 'html[data-theme="dark"] :is(.cm-sheet, .cm-inline)');
  contrast(theme["--theme-muted"], comments["--cm-soft"]);
});


test("admin controls retain contrasting text when the palette changes", () => {
  const css = sheet("app/admin/tregu/TreguAdminClient.module.css");
  const palette = { ...theme, ...declarations(css, ':global(html[data-theme="dark"]) .pageShell') };
  for (const selector of [".buttonPrimary", ".buttonYes", ".buttonAccent", ".filterTabActive", ".sectionHeader > span", ".activityRow"]) {
    const rule = declarations(css, selector);
    contrast(rule.color ?? palette["--ink"], rule.background, palette);
  }
});

test("newspaper actions and text use separate inverse surface and ink roles", () => {
  const css = sheet("app/per-ty/paper/newspaper.css");
  const palette = { ...theme, ...declarations(css, 'html[data-theme="dark"] .np') };
  for (const selector of [".np-tool--primary", ".np-btn"]) {
    const rule = declarations(css, selector);
    contrast(rule.color, rule.background, palette);
  }
});


test("competition outcome rows cannot retain white glass underneath light labels", () => {
  const css = sheet("app/globals.css");
  const row = declarations(css, '.tregu-native-market[data-competition] .tregu-native-outcome');
  contrast(theme["--theme-ink"], row.background);
});

test("the city-card section follows its dark foreground rather than keeping a cream canvas", () => {
  const css = sheet("components/visit/visit-v2.module.css");
  const section = declarations(css, ".citySection");
  contrast(section.color, section.background);
});
