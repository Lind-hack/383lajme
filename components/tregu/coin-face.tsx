// Exact port of the CoinFace coin from the approved standalone mock:
// ridged conic-gradient edge, radial-lit gold face, sweeping shine, idle
// float, hover tilt and the earn flip. Reference scales from the mock:
// xs 28px, sm 76px, xl 168px — any size works, metrics interpolate from
// the nearest reference design. Idle float + shine are on at every size
// (the mock only dropped them on the inline xs badge); the navbar coin
// should breathe and glint just like the big one.

const RING_13 =
  "conic-gradient(from 0deg,#8a5a17,#E8A33D 8%,#8a5a17 16%,#E8A33D 24%,#8a5a17 32%,#E8A33D 40%,#8a5a17 48%,#E8A33D 56%,#8a5a17 64%,#E8A33D 72%,#8a5a17 80%,#E8A33D 88%,#8a5a17 96%,#E8A33D 100%)";
const RING_9 =
  "conic-gradient(from 0deg,#8a5a17,#E8A33D 12%,#8a5a17 24%,#E8A33D 36%,#8a5a17 48%,#E8A33D 60%,#8a5a17 72%,#E8A33D 84%,#8a5a17 100%)";
const FACE =
  "radial-gradient(circle at 32% 28%, #FCE3A8 0%, #F2C069 24%, #E8A33D 55%, #C6841F 82%, #93610F 100%)";

export default function CoinFace({
  size = 28,
  numeral = "383",
  spinning = false,
  shine,
  idle = true,
  hoverTilt = false,
}: {
  size?: number;
  numeral?: string;
  spinning?: boolean;
  shine?: boolean;
  // Idle bob. On by default; flying/tumbling particles pass false so they
  // don't fight the flight transform.
  idle?: boolean;
  hoverTilt?: boolean;
}) {
  const small = size < 50;
  const large = size >= 120;
  const inset = Math.max(2, Math.round(size * (small ? 2 / 28 : large ? 8 / 168 : 4 / 76)));
  const font = Math.round(size * (small ? 11 / 28 : 19 / 76));
  const showShine = shine ?? true;

  const ringShadow = small
    ? "0 2px 4px rgba(0,0,0,0.25)"
    : large
      ? "0 14px 26px rgba(80,45,10,0.35), 0 3px 6px rgba(0,0,0,0.2)"
      : "0 6px 12px rgba(80,45,10,0.35), 0 2px 3px rgba(0,0,0,0.2)";
  const faceShadow = small
    ? "inset 0 1px 2px rgba(255,255,255,0.65), inset 0 -3px 5px rgba(0,0,0,0.35)"
    : large
      ? "inset 0 2px 4px rgba(255,255,255,0.65), inset 0 -8px 14px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(255,236,190,0.45)"
      : "inset 0 1px 2px rgba(255,255,255,0.65), inset 0 -4px 7px rgba(0,0,0,0.35)";

  // Idle float + earn flip live on this inner wrapper so the hover tilt
  // (outer) never fights them. Small coins get a proportional flip — the
  // full 30px hop would launch a 28px coin out of the navbar. Class-based
  // so prefers-reduced-motion can switch them all off.
  const animClass = spinning
    ? small
      ? "coin-anim-spin-xs"
      : "coin-anim-spin"
    : idle
      ? "coin-anim-float"
      : undefined;

  return (
    <span
      className={hoverTilt ? "coin-hover-tilt" : undefined}
      style={{ position: "relative", display: "block", width: size, height: size, flexShrink: 0 }}
      aria-hidden
    >
      <span className={animClass} style={{ position: "absolute", inset: 0, display: "block" }}>
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            backgroundColor: "#8a5a17",
            backgroundImage: small ? RING_9 : RING_13,
            boxShadow: ringShadow,
          }}
        />
        <span
          style={{
            position: "absolute",
            inset,
            borderRadius: "50%",
            overflow: "hidden",
            background: FACE,
            boxShadow: faceShadow,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {showShine && <span className="coin-shine" />}
          <span
            style={{
              position: "relative",
              fontFamily: "'Arial Black', 'Helvetica Neue', sans-serif",
              fontWeight: 900,
              fontSize: font,
              letterSpacing: large ? "-1px" : small ? undefined : "-0.5px",
              color: "#8a5a17",
              textShadow: "0 1px 0 #FCE3A8, 0 -1px 1px rgba(107,63,13,0.55)",
              lineHeight: 1,
            }}
          >
            {numeral}
          </span>
        </span>
      </span>
    </span>
  );
}
