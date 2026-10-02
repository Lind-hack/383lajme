# "Gazeta jote": 383 as the reader's own paper

Agreed with Lind on 2026-10-02.

## Problem statement

How might we make 383 feel like the reader's own paper — one that knows them,
comes to them and tells their story — for every reader from the first visit,
without an account, so that they come back every day?

## Recommended direction

Three layers on one invisible foundation, all kept on the reader's device.

1. **It's yours.**
   - The masthead reads **"Gazeta e Lindit · Nr. 47"**: the reader's name
     (asked once, as a guest) and their count of days with 383.
   - **Dardani remembers**: "sot ka vazhdim të asaj që lexove dje", and
     "mungove 3 ditë — ja çfarë ndodhi në Prishtinë".
2. **It comes to you.**
   - A **07:00 push, Kosovo time, for everyone**: "Edicioni yt i mëngjesit
     është gati".
   - The push carries nothing personal; the seven stories are put together on
     the device when it is opened. This is the habit trigger daily return
     depends on.
3. **It tells your story.** "Muaji yt me 383" every month and "Viti yt me 383"
   in December: swipeable cards narrated by Dardani, readable on 383 and
   **exported as images and as a 9:16 video** for TikTok, Reels and Stories.
   They cover:
   - the person of the year;
   - **the reader's city's year** (how many stories, how many they read, the
     biggest one);
   - morning or evening reading;
   - the question of the year to Dardani;
   - the longest streak;
   - the Tregu record;
   - a reader type **named in Dardani's voice** ("Ti je Analisti im!").

**The ledger comes first.** A device-only monthly tally of reads, people,
towns, topics, questions to Dardani, visit days and reading hours. The wrapped
can only show what was recorded, so every day without it is a day missing
from the 2026 wrapped.

## Key assumptions to validate

- [ ] **Personal touches raise 7-day return.** GA4 cohort: readers who see
      their named masthead vs those who don't.
- [ ] **Device data lasts long enough.**
  - Safari deletes script-written storage after 7 days without a visit.
  - Measure how many readers lose history; offer sign-in as "keep your year
    safe".
- [ ] **Readers share wrapped cards.** Test the first monthly card with the
      @building.ai audience before building the yearly one.
- [ ] **Readers accept a 07:00 push.**
  - Measure opt-in and open rates.
  - iPhone needs 383 added to the home screen, so show that hint.
- [ ] **The video can be made on the reader's phone.**
  - Safari records MP4. Chrome on Android records WebM, which TikTok and
    Instagram may refuse.
  - Upload a 10-second test video from both phones before building the full
    wrapped.
  - Rendering on the server would mean sending the reader's stats there.

## MVP scope

1. The ledger, with tests.
2. Name + issue number, and Dardani's continuity and absence lines.
3. The 07:00 push, on the existing web push.
4. The monthly wrapped on 1 November; the yearly wrapped in December,
   including the city's year from public newsroom data.

## Not doing (and why)

- **Person and town alerts.** They need the reader's follows on the server;
  Lind chose device-only.
- **Town front page.** The newsroom publishes 1–4 small-town stories a week;
  revisit after the newsroom-supply fix.
- **Audio edition.** Text-to-speech costs per reader; a later experiment.
- **Site-wide personal touches (Sot, Tregu, Bota).** Prove the core first.
- **"Top X% of readers" claims.** A guest's device cannot compare itself with
  others; no invented numbers.

## Decided

- Push at 07:00 Kosovo time for everyone.
- Wrapped readable on 383 and exportable as image and video.
- Reader types named by Dardani.
- Everything on the device; sign-in only syncs.
