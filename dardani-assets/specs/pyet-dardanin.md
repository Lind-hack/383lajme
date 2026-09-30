# Dardani në Pyet Dardanin — spec

This spec adds the mascot (Dardani) to three existing surfaces on 383ks.com. It only changes the visuals: the AI/search logic, API calls and answers stay exactly as they are.

`reference/pyet-dardanin-prototype.dc.html` is the clickable prototype this spec comes from. Treat it as a reference for markup, CSS and state logic only. It is not production code.

## Assets (paths inside dardani-assets/, after running download-assets.mjs)

| File | Use |
|---|---|
| `files/stills/dardani-avatar-neutral.png` | Default face: header button, idle card, collapsed bubble |
| `files/stills/dardani-avatar-thinking.png` | While the request is in flight, before the first token (wing on chin) |
| `files/stills/dardani-avatar-talking.png` | While the answer is streaming (beak open) |
| `files/stills/dardani-avatar-happy.png` | Answer finished and it has at least one source |
| `files/stills/dardani-face-confused.png` | Answer finished but nothing was found in the archive |
| `files/stills/dardani-wave.png` | Waving, full body: the peek on the article questions card and the empty state of the modal |
| `files/loops/dardani-researching.webm` + `.mp4` | Animated: Dardani sweeping a magnifier. Shown in the answer card while it searches |

All PNGs have transparent backgrounds. Faces are head-and-shoulders crops, so put them in a circle with `overflow:hidden` and bottom-aligned (`display:flex; align-items:flex-end; justify-content:center`), with the image about 5% wider than the circle. Circle background: `#FCE3DB`.

Preload all five faces when the chat UI mounts so swaps are instant.

## One state → one face (shared by every surface)

```
idle / empty           → neutral
request sent, no text  → thinking      status: "Po kërkon në arkivin e 383"  + 3 bouncing dots
streaming text         → talking       status: "Po shkruan përgjigjen"        + blinking caret after text
done, sources > 0      → happy         status: "Bazuar në N artikuj të 383"
done, nothing found    → confused      status: "Arkivi nuk e ka këtë ende"
```

"Nothing found" is whatever the backend already returns when the archive has no answer (for example an empty sources array). Reuse that flag and don't invent a new one. On each swap, fade and scale the image in over 260ms.

## Surface 1: the article questions popup (top right)

This is the existing "Pyet 383 për këtë lajm" floating card and its collapsed `.pyet-bubble`.

- Rename the title to **"Pyet Dardanin"** with the subtitle **"për këtë lajm"**. "Pyet 383" and "Pyet Dardanin" shouldn't both exist; also rename the inline card title "Pyet 383 për këtë lajm" to "Pyet Dardanin për këtë lajm".
- **The peek:** put `files/stills/dardani-wave.png` about 124px tall, absolutely positioned at `left:16px; top:-60px`, behind the card (card `z-index:1`, image `z-index:0`). The card's white background hides his lower body, so only his head and waving wing show above the top edge.
  - The card must have `overflow: visible`.
  - Indent the title about 82px so it clears him.
  - Idle animation: `translateY(0 → -4px)` and `rotate(0 → -2deg)`, 3.2s ease-in-out, infinite.
- **Entrance:** pop in over 420ms with `cubic-bezier(.2,.9,.3,1.2)`, from `translateY(-10px) scale(.96)` and opacity 0. Keep the existing trigger (it appears on scroll).
- **Question buttons:** cream background `#F9F6F1`, 1.5px border `#EFE8E0`, radius 12, a → arrow on the right. On hover: border `#FF4422`, background `#FFF4F0`, `translateX(2px)`.
- **Collapsed bubble:** replace the sparkle icon with a 60px circle showing his face (neutral, or the current state face while an answer is loading). Give it a 3px white border, the soft shadow and a small `#FF4422` dot top-right with a ping animation. `aria-label="Hap pyetjet e Dardanit për këtë lajm"`.

## Surface 2: clicking a question → the inline answer card

Keep the existing behaviour: the popup collapses and the page scrolls to the card. Change the card as follows.

- **Header row:** a 60px face circle (the state face), with the title "Pyet Dardanin për këtë lajm" and the status line from the state table beside it. Show the dots only while thinking or streaming.
- **The question:** show it as a peach pill (`#FCE3DB`, radius `12 12 12 4`).
- **While thinking:** show `files/loops/dardani-researching.webm` + `.mp4` at 150×112, `object-fit:cover`, radius 16, next to 3 shimmering placeholder bars (92% / 78% / 54% width). This replaces a blank wait.
- **While streaming:** show the text with a 2px `#C2340F` caret blinking at the end.
- **When done:** show the answer, then:
  - the existing "BAZUAR NË" sources;
  - if nothing was found, the note "Dardani përgjigjet vetëm nga artikujt e 383. Kur arkivi nuk e ka, e thotë hapur.";
  - a "PYET EDHE" row with the other suggested questions as chips.
- **Card style:** white, radius 24, 1px border `#F1E6DE`, shadow `0 10px 30px rgba(120,60,20,.07)`, padding 24.

## Surface 3: the "Pyet Dardanin" header button and modal

- **Header button:**
  - Add a 32px face circle at the left inside the pill (neutral face).
  - Use the accessible orange `#D9361A` with a `0 3px 0 #A8290F` bottom shadow. `#FF4422` with white text fails contrast.
- **Modal header:** add a 34px face circle before "Pyet Dardanin". It follows the state face.
- **Empty state, above the input:**
  - `files/stills/dardani-wave.png` at 164px tall with the peek sway animation.
  - Next to him, a speech bubble (white, border `#F1E6DE`, radius `18 18 18 4`):
    - bold line: **"Tungjatjeta! Unë jam Dardani."**
    - second line: "Më pyet për çdo lajm. Përgjigjem vetëm nga artikujt e 383, gjithmonë me burim."
  - Background: a faint gradient `#FFF6F2 → #FFFFFF`.
- **Conversation:**
  - User messages sit on the right in a peach bubble (radius `16 16 4 16`).
  - Dardani's messages sit on the left: a 44px face circle next to a cream bubble (`#F9F6F1`, radius `4 16 16 16`).
  - Each Dardani message's face follows its own state, and older finished messages keep their final face.
- **Input placeholder:** "Bëj një pyetje për lajmet…" on the empty state, "Pyet diçka tjetër…" once there are messages.

## Motion and accessibility

- Wrap every animation above in `@media (prefers-reduced-motion: reduce) { animation: none }`.
- Decorative faces inside labelled buttons get `alt=""`. The state face in the card and chat gets a real `alt`: "Dardani duke menduar", "Dardani duke folur", "Dardani i gëzuar" or "Dardani i hutuar".
- The status line should be `aria-live="polite"` so screen readers hear "Po kërkon…" and then "Bazuar në…".
- Text colour on cream: body `#111`, secondary `#5c5853`. Accent text `#C2340F`.

## Mobile (not designed yet)

The top-right popup should become a bottom sheet, with Dardani peeking over the sheet's top edge in the same way.
