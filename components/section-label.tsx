// Shared section heading: accent bar + uppercase label + rule.
// Used across homepage sections, article page, and category pages.

type SectionLabelProps = {
  label: string;
  accent?: string;
  dark?: boolean;
  right?: React.ReactNode;
  marginBottom?: number;
  /** "double" renders a newspaper Oxford rule instead of the hairline. */
  rule?: "hairline" | "double";
  /** Small overline above the label row, e.g. "EDICIONI · 12 QERSHOR 2026". */
  kicker?: string;
};

export default function SectionLabel({
  label,
  accent = "#FF4422",
  dark = false,
  right,
  marginBottom = 20,
  rule = "hairline",
  kicker,
}: SectionLabelProps) {
  const hairline = dark ? "rgba(255,255,255,0.1)" : "#E8E3DB";
  const ruleColor = dark ? "rgba(255,255,255,0.25)" : "#111111";

  return (
    <div style={{ marginBottom: `${marginBottom}px` }}>
      {kicker && (
        <div
          style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: dark ? "rgba(255,255,255,0.5)" : "#6B6B6B",
            marginBottom: "10px",
          }}
        >
          {kicker}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
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
        {rule === "double" ? (
          <div aria-hidden style={{ flex: 1 }}>
            <div style={{ height: "3px", background: ruleColor }} />
            <div style={{ height: "2px" }} />
            <div style={{ height: "1px", background: ruleColor }} />
          </div>
        ) : (
          <div style={{ flex: 1, height: "1px", background: hairline }} />
        )}
        {right}
      </div>
    </div>
  );
}
