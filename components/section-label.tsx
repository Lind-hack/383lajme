// Section headings: accent-bar variant (default) + kicker-rule variant.

type SectionLabelProps = {
  label: string;
  kicker?: string;          // small-caps line above the label (editorial kicker)
  variant?: "bar" | "rule"; // bar = left accent bar; rule = centered rule with label
  accent?: string;
  dark?: boolean;
  right?: React.ReactNode;
  marginBottom?: number;
};

export default function SectionLabel({
  label,
  kicker,
  variant = "bar",
  accent = "#FF4422",
  dark = false,
  right,
  marginBottom = 20,
}: SectionLabelProps) {
  const ink = dark ? "#FFFFFF" : "#111111";
  const rule = dark ? "rgba(255,255,255,0.1)" : "#E8E3DB";

  if (variant === "rule") {
    return (
      <div style={{ marginBottom, textAlign: "center" }}>
        {kicker && (
          <p
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: accent,
              margin: "0 0 6px",
            }}
          >
            {kicker}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ flex: 1, height: "1px", background: rule }} />
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: ink,
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
          <div style={{ flex: 1, height: "1px", background: rule }} />
        </div>
      </div>
    );
  }

  // Default: bar variant
  return (
    <div style={{ marginBottom }}>
      {kicker && (
        <p
          style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: accent,
            margin: "0 0 4px 20px",
          }}
        >
          {kicker}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
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
            color: ink,
          }}
        >
          {label}
        </span>
        <div style={{ flex: 1, height: "1px", background: rule }} />
        {right}
      </div>
    </div>
  );
}
