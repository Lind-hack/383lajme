# Dardani master pack

Everything for the 383ks.com mascot in one folder: 14 looping videos (each as an MP4 and a transparent WebM) and 43 stills (transparent PNGs, plus the celebrating pose with its background). Each file comes with a map of exactly where on the site it goes.

## How to use it with Claude Code

1. Move this `dardani-assets` folder into the root of your 383ks.com repo.
2. Open a terminal in the repo and run `claude`.
3. Open `PROMPT.md`, copy everything under the line, and paste it in.

Claude Code downloads the full-quality files first (`download-assets.mjs`), then makes small web versions, finds each place in your code, shows you the plan, and wires everything in, phase by phase.

## What's inside

| | |
|---|---|
| `ASSET-MAP.md` | Every file and where it goes, grouped by page/feature. Start here. |
| `asset-map.json` | The same map for code: paths, triggers, Albanian copy and alt text. |
| `download-assets.mjs` | Downloads all the full-quality images and videos into `files/`. Needs Node 18+. Add `--with-backgrounds` to also get every still with its original background. |
| `specs/pyet-dardanin.md` | Detailed spec for the chat, the article questions card and the answer card. |
| `reference/` | The clickable prototypes from the design canvas (Pyet Dardanin and Për ty onboarding). |
| `preview/all-stills.jpg` | Contact sheet of every still with its file name. |
| `preview/loops/` | Small animated previews of every loop, so you can see which is which. |
| `files/stills-with-background/dardani-celebrating.png` | Already included. It's the only pose without a transparent version yet. |

## Important: the download links expire

The links in `asset-map.json` work until **3 October 2026**. Run the download before then. If they've expired, every file can still be downloaded by hand from its Magnific page (also listed in `asset-map.json`), or ask Claude for a fresh `asset-map.json`.

## File names

Every file is named `dardani-<name>`, and the same name is used for the loop, its transparent WebM and its still, for example:
- `dardani-running.mp4`
- `dardani-running.webm`
- `dardani-running.png`

That's how the map and the components connect them.
