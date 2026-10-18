---
version: 1
slug: "components-newsletter-card-tsx"
primary_target: "components/newsletter-card.tsx"
related_targets: ["components/newsletter-card.module.css", "components/newsletter-signup.tsx", "components/newsletter-signup.module.css", "app/page.tsx", "components/nav-side-panel.tsx"]
---

# Newsletter — Një javë lajme. Një email për ty.

## THESIS

Make the weekly newsletter a distinctive invitation within the homepage news scroll, with direct email signup also available beneath Tregu in the hamburger menu. Readers subscribe where they encounter the invitation; no separate subscription landing page is needed.

## OWN-WORLD

Extend the incumbent 383 Manrope, orange, cream, and ink system described in DESIGN.md and PRODUCT.md. The scoped orange card (#ff5a36), bold tightly tracked headline, cream input, and ink action give this invitation its own emphasis without changing global tokens. A dimensional folded cream envelope is built entirely in CSS; the compact drawer version uses a mail icon. No new raster assets.

## STORY

Recognize the weekly news promise and Sunday 18:00 Kosovo delivery time → enter an email address → explicitly consent → submit inline → follow confirmation in the inbox. The footer is a shortcut to the homepage card. Plain `/newsletter` redirects to `/#newsletter`; existing backend subscription, confirmation, and unsubscribe utility screens remain in place.

## FIRST VIEWPORT

On desktop, the rounded orange card pairs headline, description, and form on the left with the dimensional envelope on the right. At mobile widths (640px and below), the envelope moves above the copy and the card becomes one column. The hamburger menu contains a compact direct signup immediately below Tregu, with a smaller headline, mail icon, and form rather than a navigation-only promotion.

## FORM

Seed: the existing 383 visual system and user-directed editorial mail-card composition. Implemented in NewsletterCard and NewsletterSignup with their scoped CSS modules; app/page.tsx mounts the full card and components/nav-side-panel.tsx mounts its compact variant. This is a local surface extension, not a new visual world; root DESIGN.md and its sidecar remain authoritative and unchanged.

## Interaction contract

- Provide a visible email label, native email validation, required consent, and visible keyboard focus for input, submit, checkbox, and privacy link.
- Submit through the existing `/api/newsletter/subscribe` endpoint. Disable controls while sending and announce loading, success, and error states; network failure leaves a retry path.
- Keep the cream envelope decorative and hidden from assistive technology. Restrict its hover movement to motion-enabled devices and remove spinner animation and transitions for reduced motion.
- Pass NavSidePanel's onClose through the card/form onNavigate callback so the privacy link closes the drawer when navigating.

## Verification evidence

Rendered evidence: `.impeccable/review/newsletter/desktop.png`, `mobile.png`, and `menu-mobile.png`. The finishing review's privacy-link drawer issue was fixed through onNavigate. Release validation on current main: all 1,366 tests and the production build pass. The reduced-height homepage card keeps the reviewed illustration and form; the compact drawer dimensions are unchanged.
