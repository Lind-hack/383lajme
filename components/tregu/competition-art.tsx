/** Transparent, original competition-inspired decoration. Content stays above it. */
export default function CompetitionArt({ league }: { league?: string | null }) {
  if (!league?.startsWith("uefa.")) return null;
  const champions = league === "uefa.champions";
  const conference = league === "uefa.europa.conf";
  return <svg className="tregu-competition-art" viewBox="0 0 480 200" aria-hidden="true" focusable="false">
    {champions ? <g fill="none" stroke="currentColor">
      <path d="M-20 200 Q240 20 500 200 M-20 200 Q240 75 500 200 M40 200 Q240 104 440 200" strokeWidth="2" />
      <path d="M90 194 108 134 181 104 280 101 367 137 399 195" strokeWidth="1.5" />
      <path d="m108 134 52 4 21-34 22 34 77-37-23 46 110-10-62 34 94 24-114-1-45-36-34 36-116 0 70-31z" fill="currentColor" fillOpacity=".12" strokeWidth="2" />
      {Array.from({length: 22}, (_, i) => <path key={i} d={`M${50+i*18} 185 v15`} opacity=".3" />)}
    </g> : <g fill="none" stroke="currentColor">
      {Array.from({length: 9}, (_, i) => <path key={i} d={conference ? `M${-40+i*17} 210 C${50+i*5} ${-40+i*16}, ${230+i*13} ${310-i*12}, ${500+i*9} ${35+i*9}` : `M${-90+i*28} 0  ${180+i*20} 190 ${520+i*24} ${50+i*13}`} strokeWidth={conference ? 3 : 1.8} opacity=".45" />)}
      <g transform="translate(355 25)" fill="currentColor" fillOpacity=".2" strokeWidth="1.7">
        <path d={conference ? "M8 8 Q40 -4 72 8 L55 112 61 143 19 143 25 112Z" : "M5 8 Q40 -5 75 8 L49 109 58 143 22 143 31 109Z"} />
        <path d="M8 8 31 109 19 143 M72 8 49 109 61 143 M22 7 35 110 M57 7 45 110 M40 3V137" />
        <path d="M15 148H65V157H15Z" fillOpacity=".4" />
      </g>
    </g>}
  </svg>;
}
