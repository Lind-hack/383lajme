# Dardani asset map

Every file, and exactly where it goes. The same information is in `asset-map.json` (machine-readable, with Albanian alt text for each file).

Loops come in two versions: `.mp4` (H.264, up to 1080p, plays everywhere) and `.webm` (VP9 with a transparent background, for Chrome/Firefox/Android). Stills are transparent `.png` cut-outs unless they're in `stills-with-background/`.

## Page loader (every page)

| File | When it shows |
|---|---|
| `dardani-running.mp4` + `dardani-running.webm` | Full-page loader with the orange progress bar ("Po ngarkohet…"). |
| `dardani-running.png` | Static fallback for the running loader. |

## Homepage & first visit

| File | When it shows |
|---|---|
| `dardani-greeting.mp4` + `dardani-greeting.webm` | First visit / welcome moments. Onboarding step 1 (Mirë se vjen). |
| `dardani-idle.mp4` + `dardani-idle.webm` | Default resting state anywhere Dardani is on screen and nothing is happening. |
| `dardani-idle.png` | Static fallback for the idle loop (reduced motion, slow connections). |
| `dardani-wave.png` | Peeks over the top-right article questions card; empty state of the Pyet Dardanin modal; greeting fallback. |
| `dardani-standing-alt.png` | Alternative neutral full-body pose for marketing/about pages. |

## Page transitions & section headers

| File | When it shows |
|---|---|
| `dardani-flying.mp4` + `dardani-flying.webm` | Section changes, friendlier alternative loader. |
| `dardani-flying.png` | Static fallback for the flying loop. |

## Për ty onboarding (8 steps, prototype on the canvas)

| File | When it shows |
|---|---|
| `dardani-greeting.mp4` + `dardani-greeting.webm` | First visit / welcome moments. Onboarding step 1 (Mirë se vjen). |
| `dardani-thinking-bubble.mp4` + `dardani-thinking-bubble.webm` | Longer AI answers being composed (large view). Onboarding step 2 (how much time). |
| `dardani-explaining.mp4` + `dardani-explaining.webm` | "Çfarë ka të re" callouts and feature tours. Onboarding step 3 (topics). |
| `dardani-researching.mp4` + `dardani-researching.webm` | While a search runs, and inside the Pyet Dardanin answer card while it searches the archive. Onboarding step 4 (people). |
| `dardani-explaining-news.mp4` + `dardani-explaining-news.webm` | "Shpjegoje këtë lajm" / explain-this-article help on article pages. Onboarding step 5 (cities). |
| `dardani-bell.mp4` + `dardani-bell.webm` | Notification permission pre-prompt. Onboarding step 6 (notifications) — replaces the idle loop there. |
| `dardani-reading.mp4` + `dardani-reading.webm` | Long tasks: summaries, translations, Toni tone calculation. Onboarding step 7 (building your feed). |
| `dardani-celebrating.png` | Onboarding done screen (Gati!) with confetti. Only available with its background (cream), no transparent cut-out yet. |

## Për ty feed

| File | When it shows |
|---|---|
| `dardani-flying-news.mp4` + `dardani-flying-news.webm` | "Ka lajme të reja" banner, daily digest, push-notification promo. |
| `dardani-flying-news.png` | Static fallback for the flying-with-newspaper loop. |
| `dardani-sleeping.mp4` + `dardani-sleeping.webm` | "Asnjë lajm i ri tani për tani" and late-night quiet hours. |
| `dardani-sleeping.png` | Static fallback for the sleeping loop. · copy: “Asnjë lajm i ri tani për tani” |
| `dardani-streak.png` | Daily reading streak. · copy: “3 ditë rresht!” |
| `dardani-empty.png` | Empty saved articles, Për ty before setup, empty search. · copy: “Ende asgjë këtu” |

## Pyet Dardanin (header button, modal, article questions card, answer card)

| File | When it shows |
|---|---|
| `dardani-avatar-neutral.png` | Chat avatar: idle/empty state, header button, collapsed bubble. |
| `dardani-avatar-thinking.png` | Chat avatar: request sent, before first token. |
| `dardani-avatar-talking.png` | Chat avatar: while the answer streams. |
| `dardani-avatar-happy.png` | Chat avatar: answer done with sources. |
| `dardani-face-confused.png` | Chat avatar: nothing found in the archive; search with no results. |
| `dardani-wave.png` | Peeks over the top-right article questions card; empty state of the Pyet Dardanin modal; greeting fallback. |
| `dardani-researching.mp4` + `dardani-researching.webm` | While a search runs, and inside the Pyet Dardanin answer card while it searches the archive. Onboarding step 4 (people). |
| `dardani-headbob.mp4` + `dardani-headbob.webm` | Tiny inline loaders and the chat typing indicator (crop to a circle). |
| `dardani-thinking-bubble.mp4` + `dardani-thinking-bubble.webm` | Longer AI answers being composed (large view). Onboarding step 2 (how much time). |
| `dardani-thinking-bubble.png` | Static fallback for the thinking-bubble loop. |
| `dardani-face-surprised.png` | Reaction face: breaking news / surprising result. |
| `dardani-face-sad.png` | Reaction face: sensitive stories, failed requests. |
| `dardani-face-laughing.png` | Reaction face: light moments, Tregu wins. |
| `dardani-face-wink.png` | Reaction face: tips and hidden features. |

## Article pages

| File | When it shows |
|---|---|
| `dardani-explaining-news.mp4` + `dardani-explaining-news.webm` | "Shpjegoje këtë lajm" / explain-this-article help on article pages. Onboarding step 5 (cities). |

## Search

| File | When it shows |
|---|---|
| `dardani-researching.mp4` + `dardani-researching.webm` | While a search runs, and inside the Pyet Dardanin answer card while it searches the archive. Onboarding step 4 (people). |
| `dardani-researching.png` | Static fallback for the researching loop. |
| `dardani-face-confused.png` | Chat avatar: nothing found in the archive; search with no results. |
| `dardani-empty.png` | Empty saved articles, Për ty before setup, empty search. · copy: “Ende asgjë këtu” |

## Tregu

| File | When it shows |
|---|---|
| `dardani-tregu-explainer.mp4` + `dardani-tregu-explainer.webm` | Tregu tutorial step 1 "Si funksionon Tregu". |
| `dardani-tregu-explainer.png` | Tregu tutorial step 1. · copy: “Si funksionon Tregu” |
| `dardani-tregu-predict.png` | Tregu tutorial step 2 / first-trade tooltip. · copy: “Bëj parashikimin tënd” |
| `dardani-tregu-win.png` | Won a prediction (modal/toast) + tutorial step 3. · copy: “E qëllove!” |
| `dardani-tregu-lose.png` | Lost a prediction — gentle shrug + tutorial step 4. · copy: “Kësaj radhe jo” |
| `dardani-tregu-portfolio.png` | Header of Portofoli im, empty balance. · copy: “Portofoli im” |

## Toni

| File | When it shows |
|---|---|
| `dardani-toni.png` | Header art for the Toni tone index. · copy: “Toni i botës për Kosovën” |
| `dardani-reading.mp4` + `dardani-reading.webm` | Long tasks: summaries, translations, Toni tone calculation. Onboarding step 7 (building your feed). |
| `dardani-reading.png` | Static fallback for the reading loop. |

## Diaspora

| File | When it shows |
|---|---|
| `dardani-diaspora.png` | Header for Diaspora / visit pages. · copy: “Mirë se erdhe në shtëpi” |
| `dardani-airport.png` | Airport calculator ("kur duhet të nisem?"). |

## Utility cards

| File | When it shows |
|---|---|
| `dardani-weather.png` | Weather card, rainy variant. |
| `dardani-fuel.png` | Fuel prices card. |
| `dardani-exchange.png` | Currency exchange card. |

## Errors & empty states

| File | When it shows |
|---|---|
| `dardani-error-404.png` | 404 page. · copy: “Kjo faqe nuk u gjet” |
| `dardani-offline.png` | Offline / no connection. · copy: “S'ka lidhje me internetin” |
| `dardani-sorry.png` | 500 / failed loads. · copy: “Diçka shkoi keq, po e rregullojmë” |
| `dardani-empty.png` | Empty saved articles, Për ty before setup, empty search. · copy: “Ende asgjë këtu” |

## Notifications

| File | When it shows |
|---|---|
| `dardani-bell.mp4` + `dardani-bell.webm` | Notification permission pre-prompt. Onboarding step 6 (notifications) — replaces the idle loop there. |
| `dardani-bell.png` | Static fallback for the bell loop / permission pre-prompt. · copy: “Të njoftoj kur ka lajme të mëdha?” |

## Account

| File | When it shows |
|---|---|
| `dardani-key.png` | Sign in / create account. · copy: “Hyr në llogari” |

## Feature tooltips / what's new

| File | When it shows |
|---|---|
| `dardani-explaining.mp4` + `dardani-explaining.webm` | "Çfarë ka të re" callouts and feature tours. Onboarding step 3 (topics). |
| `dardani-explaining.png` | Static fallback for the explaining loop. |
| `dardani-face-wink.png` | Reaction face: tips and hidden features. |

## Occasions (date-based swaps on homepage + loader)

| File | When it shows |
|---|---|
| `dardani-flag-albania.png` | 28 Nëntor (Flag Day) — swap in on homepage + loader. · copy: “Gëzuar Ditën e Flamurit!” |
| `dardani-flag-kosovo.png` | 17 Shkurt (Kosovo Independence Day). · copy: “Gëzuar Ditën e Pavarësisë!” |
| `dardani-matchday-scarf.png` | Kosovo national team match days. · copy: “Hajde Dardanët!” |
| `dardani-new-year.png` | 31 Dhjetor – 1 Janar, year-end recap. · copy: “Gëzuar Vitin e Ri!” |

## Rules for using them

- **Video markup:** `<video autoplay muted loop playsinline preload="metadata" poster="…png">` with two sources: the `.webm` first, the `.mp4` second. Safari can't play WebM alpha, so it falls back to the MP4. Put the MP4 on a cream `#F9F6F1` background (or `#FFFFFF` inside white cards) so the box doesn't show.
- **Poster images:** use the matching still as the poster (`dardani-running.png` for `dardani-running.mp4`, and so on), so something shows before the video loads.
- **Reduced motion:** under `prefers-reduced-motion: reduce`, show the still instead of the loop.
- **Loop point:** every loop starts and ends on the same frame, so never trim it, and never add a fade at the loop point.
- **Switching loops:** when one loop replaces another, cross-fade over 150–200 ms instead of hard-cutting.
- **Size:** the 1080p files are much bigger than the UI needs. If ffmpeg is available, make web versions at 2× the largest display size (a 60px avatar needs about 128px; the page loader about 480px) and keep the originals out of the bundle.
- **Occasions:** swap on these dates, in local Kosovo time:
  - 28 Nëntor: `flag-albania`
  - 17 Shkurt: `flag-kosovo`
  - Kosovo national-team match days: `matchday-scarf`. Take the dates from a config list; don't hard-code them.
  - 31 Dhjetor – 1 Janar: `new-year`
