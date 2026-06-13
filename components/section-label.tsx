// Shared section heading: accent bar + uppercase label + hairline.
// Used across homepage sections, article page, and category pages.

type SectionLabelProps = {
  label: string;
  accent?: string;
  dark?: boolean;
  right?: React.ReactNode;
  marginBottom?: number;
};

export default function SectionLabel({
  label,
  accent = "#FF4422",
  dark = false,
  right,
  marginBottom = 20,
}: SectionLabelProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        marginBottom: `${marginBottom}px`,
      }}
    >
      <div
        style={{
          width: "4px",
          height: "28px",
          background: accent,
          borderRadius: "2px",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: "13px",
          fontWeight: 800,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: dark ? "#FFFFFF" : "#111111",
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: "1px",
          background: dark ? "rgba(255,255,255,0.1)" : "#E8E3DB",
        }}
      />
      {right}
    </div>
  );
}
