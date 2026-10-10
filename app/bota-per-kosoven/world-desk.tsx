// The page's masthead: a foreign desk at night. Ink, a wireframe globe tilted
// towards the Balkans with Kosovo pinned in 383 orange, the country's name in
// the world's scripts running along the top like a wire dateline. Everything Bota says comes after this,
// so it says the one thing first: the world, looking at us.

import DardaniImage from "@/components/dardani/dardani-image";
import WorldDateline from "@/components/tone/world-dateline";
import s from "./bota.module.css";

// An orthographic globe tilted 20° north, centred on Kosovo's meridian (21°E).
// Parallels are drawn as ellipses: centre y = R·sin(lat)·cos(tilt), radii
// R·cos(lat) by R·cos(lat)·sin(tilt). Meridians are ellipses of width
// R·sin(Δlon). Kosovo (42.6°N) sits on the front of its parallel.
const R = 180;
const TILT = (20 * Math.PI) / 180;
const PARALLELS = [-60, -30, 0, 30, 60].map((lat) => {
  const r = (lat * Math.PI) / 180;
  return { cy: 200 - R * Math.sin(r) * Math.cos(TILT), rx: R * Math.cos(r), ry: R * Math.cos(r) * Math.sin(TILT) };
});
const MERIDIANS = [30, 60].map((d) => R * Math.sin((d * Math.PI) / 180));
const KOSOVO = (() => {
  const p = (42.6 * Math.PI) / 180;
  return { x: 200, y: 200 - R * Math.sin(p) * Math.cos(TILT) + R * Math.cos(p) * Math.sin(TILT) };
})();

function Globe() {
  return (
    <svg className={s.globe} viewBox="0 0 400 400" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <circle cx="200" cy="200" r={R} strokeOpacity="0.5" />
        {PARALLELS.map((p, i) => (
          <ellipse key={`p${i}`} cx="200" cy={p.cy} rx={p.rx} ry={p.ry} strokeOpacity="0.28" />
        ))}
        <line x1="200" y1={200 - R} x2="200" y2={200 + R} strokeOpacity="0.28" />
        {MERIDIANS.map((rx, i) => (
          <ellipse key={`m${i}`} cx="200" cy="200" rx={rx} ry={R} strokeOpacity="0.22" />
        ))}
      </g>
      <g className={s.globePin}>
        <circle className={s.globeRing} cx={KOSOVO.x} cy={KOSOVO.y} r="10" />
        <circle cx={KOSOVO.x} cy={KOSOVO.y} r="5.5" fill="#ff4422" />
      </g>
    </svg>
  );
}

export default function WorldDesk() {
  return (
    <header className={s.desk}>
      <Globe />
      <WorldDateline />
      <div className={s.deskInner}>
        <div className={s.deskCopy}>
          <h1 className={s.deskTitle}>Bota për Kosovën</h1>
          <p className={s.deskLede}>
            Çfarë thonë gazetat e huaja për ne? Lexoje në shqip, zbulo vende të reja
            dhe ndaje një artikull me familjen.
          </p>
        </div>
        <DardaniImage name="toni" className={s.deskMascot} priority sizes="(max-width: 560px) 84px, 150px" />
      </div>
    </header>
  );
}
