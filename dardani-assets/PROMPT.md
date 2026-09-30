Paste everything below the line into Claude Code, running in the root of the 383ks.com repo, after you've put the `dardani-assets/` folder there.

---

I've added a folder `dardani-assets/` to the repo root. It has everything for our mascot Dardani:

- `asset-map.json`: every image and video, with its file path, where it's used on the site, when it shows, suggested Albanian copy, and Albanian alt text. This is the source of truth.
- `ASSET-MAP.md`: the same map as readable tables, grouped by page/feature, plus the rules for using videos.
- `download-assets.mjs`: downloads all the full-quality files into `dardani-assets/files/`.
- `specs/pyet-dardanin.md`: the detailed spec for the Pyet Dardanin chat, the article questions card and the answer card.
- `reference/`: two clickable prototypes (Pyet Dardanin, and the Për ty onboarding). They're design references for layout, CSS and state logic only, not code to copy.
- `preview/`: a contact sheet of every still and small previews of every loop, so you can see what each file looks like.

Please work in phases and stop after each phase to show me what you did.

**Phase 1: get the files.**
- Run `node dardani-assets/download-assets.mjs`. If any downloads fail (the links expire on the date shown), stop and tell me which ones.
- Add `dardani-assets/files/` to `.gitignore`. Those are big source files and shouldn't be committed.

**Phase 2: make web versions and a central manifest.**
- Put optimized copies in the project's normal public/static folder under `mascot/`, keeping the `dardani-<name>` file names.
- Stills: trim the transparent padding around each image, then resize to 2× the largest size it's shown at. Most need 256–512px. Faces/avatars can be about 160px, and full-body poses about 480px tall. Export WebP with alpha, and keep a PNG fallback only if the project needs one.
- Loops: if ffmpeg is installed, make these at 480px wide:
  - an H.264 MP4 (`-crf 26 -movflags +faststart`, no audio)
  - a VP9 WebM that keeps the transparency (`-c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 34`, no audio)
  - a poster frame
  If ffmpeg isn't installed, tell me and use the downloaded files as they are.
- Generate one small typed module from `asset-map.json` (names → web paths, alt text) so every component looks files up by name, never by hard-coded path.
- Build two tiny components:
  - `DardaniImage name="…"` renders the image with its alt text.
  - `DardaniLoop name="…"` renders `<video autoplay muted loop playsinline preload="metadata">` with the WebM source first and the MP4 second, the matching still as the poster, and under `prefers-reduced-motion: reduce` just the still.

**Phase 3: find where everything goes.** Search the codebase for every place listed in ASSET-MAP.md:
- page loader, homepage hero, Për ty onboarding and feed
- Pyet Dardanin (header button, modal, the "Pyet 383 për këtë lajm" floating questions card, the inline answer card)
- article pages, search
- Tregu (tutorial, win/lose, Portofoli im), Toni, Diaspora and the airport calculator
- weather/fuel/currency cards
- 404 / offline / error / empty states, the notifications permission ask, sign in

Show me a list: file in the codebase → asset name → what you'll change. If a place doesn't exist yet (for example the Tregu tutorial), tell me instead of inventing a new page.

**Phase 4: wire them in**, following ASSET-MAP.md and, for Pyet Dardanin, `specs/pyet-dardanin.md` exactly.
- Keep all existing logic, API calls and data as they are. This is visual only.
- Use the suggested Albanian copy where it's given.
- Rename "Pyet 383 për këtë lajm" to "Pyet Dardanin për këtë lajm".
- For the occasion images (flags on 28 Nëntor and 17 Shkurt, the scarf on match days, the party hat for New Year), add a small helper that swaps them in on the homepage and loader by date. Match days come from a config array, not hard-coded.

**Phase 5: check it.** Run the dev server and go through every place from Phase 3. Check the loops play and loop cleanly, the transparent WebMs have no box around them in Chrome, Safari falls back to the MP4, and reduced motion shows stills. Then give me a short summary of what changed.
