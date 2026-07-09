export default function CoinIcon({ size = 20, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={spin ? "tregu-coin-spin" : undefined}
      style={{ flexShrink: 0 }}
    >
      <defs>
        <radialGradient id="tregu-coin-face" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FDE9B0" />
          <stop offset="45%" stopColor="#F5B942" />
          <stop offset="100%" stopColor="#C4841B" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill="url(#tregu-coin-face)" stroke="#8A5A0F" strokeWidth="1" />
      <circle cx="20" cy="20" r="15.5" fill="none" stroke="#8A5A0F" strokeWidth="1" opacity="0.55" />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
        fontFamily="Manrope, sans-serif"
        fill="#6B4508"
      >
        383
      </text>
    </svg>
  );
}
