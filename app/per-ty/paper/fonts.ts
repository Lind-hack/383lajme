// The type cases of the reader's paper (app/per-ty/paper/newspaper.css).
//
// Each kind of paper (lib/paper-look.mjs) sets its own nameplate, headlines and
// body from these, the way real papers of the last century did: blackletter on
// the broadsheet, condensed poster capitals on the sports sheet, slab on the
// tabloid. Special Elite is the typewriter of the notes clipped to the paper.
//
// Only the faces a page actually uses are downloaded; nothing here preloads but
// the body text, which every paper sets.

import { Alfa_Slab_One, Anton, Old_Standard_TT, PT_Serif, Special_Elite, UnifrakturMaguntia } from "next/font/google";

const blackletter = UnifrakturMaguntia({ weight: "400", subsets: ["latin"], variable: "--np-f-blackletter", display: "swap", preload: false });
const poster = Anton({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--np-f-poster", display: "swap", preload: false });
const oldStandard = Old_Standard_TT({ weight: ["400", "700"], style: ["normal", "italic"], subsets: ["latin", "latin-ext"], variable: "--np-f-old", display: "swap", preload: false });
const body = PT_Serif({ weight: ["400", "700"], style: ["normal", "italic"], subsets: ["latin", "latin-ext"], variable: "--np-f-body", display: "swap" });
const slab = Alfa_Slab_One({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--np-f-slab", display: "swap", preload: false });
const typewriter = Special_Elite({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--np-f-type", display: "swap", preload: false });

/** Class names that define every --np-f-* variable; put on the paper's root. */
export const newspaperFonts = [blackletter, poster, oldStandard, body, slab, typewriter].map((f) => f.variable).join(" ");
