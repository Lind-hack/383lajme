// Editorial double-rule divider — two hairlines close together.

type DoubleRuleProps = {
  color?: string;
  marginTop?: number | string;
  marginBottom?: number | string;
};

export default function DoubleRule({
  color = "#111111",
  marginTop = 0,
  marginBottom = 0,
}: DoubleRuleProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        marginTop,
        marginBottom,
        display: "flex",
        flexDirection: "column",
        gap: "3px",
      }}
    >
      <div style={{ height: "2px", background: color }} />
      <div style={{ height: "1px", background: color, opacity: 0.35 }} />
    </div>
  );
}
