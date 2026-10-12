// The type of the reader's paper (app/per-ty/paper/newspaper.css).
//
// Newsreader — a serif drawn for news on screens — sets headlines and text on
// every paper; the sports sheet and the tabloid set their headlines in Anton's
// tall capitals. Labels use the site's own sans. Anton is only downloaded by
// the papers that use it.

import { Anton, Newsreader } from "next/font/google";

const serif = Newsreader({ subsets: ["latin", "latin-ext"], style: ["normal", "italic"], axes: ["opsz"], variable: "--np-f-serif", display: "swap" });
const poster = Anton({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--np-f-poster", display: "swap", preload: false });

/** Class names that define every --np-f-* variable; put on the paper's root. */
export const newspaperFonts = [serif, poster].map((f) => f.variable).join(" ");
