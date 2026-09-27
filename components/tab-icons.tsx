/**
 * Icons for the phone tab bar (components/mobile-tab-bar) that no icon set has.
 * Drawn on lucide's 24px grid and stroke so they sit with the House icon, and
 * in currentColor so they take the tab's grey/orange like it does.
 */

type IconProps = { size?: number; strokeWidth?: number };

/** Për ty: a news feed with a person badge — the feed that is yours. */
export function PersonalFeedIcon({ size = 22, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 21H5.5A2.5 2.5 0 0 1 3 18.5v-13A2.5 2.5 0 0 1 5.5 3h9A2.5 2.5 0 0 1 17 5.5V11" />
      <path d="M7 8h6" />
      <path d="M7 12h4" />
      <path d="M7 16h3" />
      <circle cx="18" cy="17.5" r="4.5" />
      <circle cx="18" cy="16.4" r="1.3" fill="currentColor" stroke="none" />
      <path d="M15.9 20.2a2.6 2.6 0 0 1 4.2 0" strokeWidth={strokeWidth * 0.8} />
    </svg>
  );
}

/**
 * Bota për Kosovën: the world, with Kosovo at its centre. The globe is line
 * art; the map is the flag's silhouette (/images/categories/kosove.svg),
 * filled through a CSS mask so the page does not carry its path twice.
 */
export function KosovoGlobeIcon({ size = 22, strokeWidth = 2 }: IconProps) {
  return (
    <span className="tab-globe" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round">
        <circle cx="12" cy="12" r="9.5" />
        {/* Meridians only at the rim, so nothing crosses the map. */}
        <path d="M8.6 3.1C6.9 5.3 6 8.5 6 12s.9 6.7 2.6 8.9M15.4 3.1C17.1 5.3 18 8.5 18 12s-.9 6.7-2.6 8.9" strokeWidth={strokeWidth * 0.7} opacity="0.55" />
      </svg>
      <span className="tab-globe-map" />
    </span>
  );
}
