# 383 daily activity email

## Overview

Read mode: help the owner understand what visitors use in under a minute. This
is a scoped, code-led extension of the existing 383 ink, cream, and orange
identity. `PRODUCT.md` and the root `DESIGN.md` remain the brand authorities;
this document records the built email, not a replacement visual system.

The renderer is `scripts/usage_email.py` (`render_email`). Its emitted direction
contract is `383-usage-email-v2`. It returns plain text and HTML. The HTML preview
is `.impeccable/review/usage-email-preview.html`; review captures are
`.impeccable/review/desktop.png`, `mobile.png`, `desktop-viewport.png`, and
`mobile-viewport.png`. These are review evidence, not shipping raster assets.
The email ships text, inline styles, and tables; it has no images or scripts.

## Colors

| Role | Built value | Use |
| --- | --- | --- |
| Ink | `#171B22` | Headings, main text, primary CTA |
| Muted | `#58616D` | Explanations, date, reporting notes |
| Orange | `#FF572D` | 383 masthead, ranking bars, focus outline |
| Cream | `#F9F6F1` | Opening and closing sections |
| White | `#FFFFFF` | Main sections and CTA text |
| Canvas | `#EDF0F3` | Outer email background |
| Divider | `#E2E6EA` | Section separators |
| Track | `#F0F2F4` | Unfilled ranking bars |
| Friction surface / text | `#FFF4E8` / `#743B13` | Separate frustration from engagement |

The six heat colors, low to high, are `#F1F4F6`, `#DAE8F3`, `#B5D2E8`,
`#FFCFB7`, `#FF8A5C`, and `#B83216`. Zero uses the first; positive values use
indices `max(1, int(value / column_max * 5))`, capped at five. Only the darkest
cell uses white text; the others use ink. Each column has its own maximum:
a darker time cell cannot be compared numerically with a darker click cell.
Exact values and the Lower/Higher legend carry meaning alongside color.

## Typography

The whole email uses `Arial, Helvetica, sans-serif`, avoiding remote font
requirements. The actual hierarchy is:

| Role | Size / weight | Other treatment |
| --- | --- | --- |
| 383 masthead | 34px / 800 | −2px tracking |
| Two-line main title | 34px / bold heading default | 1.1 line height, −1px tracking |
| Section title | 23px / bold heading default | 1.3 line height, −0.4px tracking |
| Friction value | 24px / bold | Three equal columns |
| Explanatory paragraph | 14px / normal | 1.6 line height |
| Ranking label / value | 14px / normal; 15px / 700 | Labels use 1.4 line height |
| Heatmap row label / value | 13px / 600; 13px / 700 | Numeric values centered |
| Heatmap header / date | 12px / bold; 12px / normal | Compact metadata |
| Opening metrics | 13px / normal, bold values | 1.7 line height |
| Legend | 11px / normal | Lower/Higher labels |
| Primary CTA | 14px / 700 | White text on ink |

## Layout

A centered table is fluid to a maximum width of 680px. The body has 20px vertical
padding. Sections have 28px vertical and 32px horizontal padding, with a bottom
divider; at viewport widths up to 600px they use 24px and 16px respectively.
The email relies on HTML tables and inline styling for email compatibility.
The small media rule improves mobile spacing where supported.

The fixed-layout heatmap gives 34% to section labels and divides the remaining
space among three numeric columns. It uses 4px cell spacing and wrapping labels.
Ranking labels wrap; their right-aligned values occupy an 88px column and do not
wrap. Ranking bars are 7px tall and normalized independently within each list.
No motion, hover-dependent information, or horizontal scrolling is intended.

## Elevation & Depth

The email is flat. Cream, white, the amber friction section, and thin dividers
establish grouping; there are no shadows or glass effects.

## Shapes

The email's main table is rectangular. Heat cells have a 5px radius and the
primary CTA a 6px radius. The CTA has 13px vertical and 20px horizontal padding.
These are modest email-specific treatments, not new global shape tokens.

## Components

The reading order is fixed:

1. Masthead, reporting date, “What people used today.”, factual click/time
   takeaway, and Clarity visitors/sessions beside measured website clicks.
2. **Feature activity heatmap:** named features with visits, clicks, and active
   time; independent scales, exact values, legend, definitions, and the first
   retained event when available. Features sort by clicks, then active seconds.
3. **Buttons people pressed:** button actions grouped by feature; unnamed
   controls may appear as Other.
4. **Pages people clicked into:** internal link clicks by destination.
5. **Where people spent time:** total website-counter active time per page.
6. **Pages with the most interaction:** link and button clicks made on a page.
7. **Popular pages across the day:** Clarity visits, separately sourced.
8. **Pages that held attention:** Clarity average active time per session/page.
9. **Where people got stuck:** Clarity dead clicks, rage clicks, and quick backs
   on amber, with an explanation that frustration is not useful engagement.
10. **What to look at next:** factual takeaway and the single primary action,
    “Open on-page heatmaps”, linking to
    `https://clarity.microsoft.com/projects/view/yxa7ek3m9v/heatmaps`.

Ranked lists show up to six rows. Website-counter lists omit zero rows and show
an explicit no-measurements state when empty. The heatmap distinguishes an empty
measurement window from evidence of no use. Missing Clarity frustration metrics
say “not available”; Clarity page lists have their own empty states.

**Measurement semantics.** Feature visits count page openings, not unique
visitors. Clicks count links and controls, not page views. Destination clicks
and clicks made while viewing a page answer different questions. Website active
time counts foreground interaction with a 60-second idle cutoff; its page
ranking is a total. Clarity's attention ranking is an average per session.
Clarity and website counters are separate sources and should not be silently
combined or assumed to cover identical populations/windows. Both measure
consenting visitors only. New counters may cover less than the last 24 hours;
the first retained measurement is disclosed in UTC. The header date uses
Europe/Warsaw and the footer states the daily reporting cadence.

The feature heatmap is an aggregate table, not a screenshot of on-page click
coordinates. Those positions require Clarity. Popularity alone does not prove
usefulness. Numeric input is clamped to finite nonnegative values; counts are
rounded with thousands separators, and durations display seconds, minutes and
seconds, or hours and minutes. Missing numeric fields can therefore render as
zero; source availability and coverage notes remain important.

Public page paths are filtered; sensitive invite identifiers are replaced with
placeholders, and query strings are not displayed. This is aggregate reporting,
not an individual visitor trace.

**Accessibility and compatibility.** The HTML declares English, uses an h1 and
h2 hierarchy, and keeps the data heatmap as a table with header cells. Layout
and bar tables use `role="presentation"`. Numbers and labels remain readable
without heat colors; a plain-text counterpart is generated. The Clarity link
has a 3px orange focus-visible outline with 4px offset where supported. These
are implemented affordances, not a claim of exhaustive assistive-technology or
email-client certification; media queries, corner rounding, and focus styling
can vary by email client.

## Do's and Don'ts

- **Do** preserve independent visit, click, and time scales and exact numbers.
- **Do** keep website totals, Clarity averages, visits, clicks, and frustration
  signals clearly labelled and distinct.
- **Do** retain empty states, consent scope, and partial-coverage disclosure.
- **Do** use the existing product and global design documents for brand changes.
- **Don't** substitute decorative charts or shipping screenshots for live text.
- **Don't** infer usability, causality, or unique visitors from aggregate counts.

The fresh finish review disposition was **ship**, with no material fixes. The
review validated numeric heatmap readability, independent scales, source and
metric distinctions, rankings and empty states, mobile legibility, email-safe
table layout, and the correct Clarity CTA. Browser previews are review evidence;
production email-client delivery remains a separate compatibility concern.
