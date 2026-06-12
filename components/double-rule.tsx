// Newspaper Oxford rule: thick bar over thin bar. Used as a section
// divider between major homepage tiers and in the footer.

type DoubleRuleProps = {
  dark?: boolean;
  marginTop?: number;
  marginBottom?: number;
};

export default function DoubleRule({
  dark = false,
  marginTop = 0,
  marginBottom = 0,
}: DoubleRuleProps) {
  const color = dark ? "rgba(255,255,255,0.25)" : "#111111";
  return (
    <div aria-hidden style={{ marginTop: `${marginTop}px`, marginBottom: `${marginBottom}px` }}>
      <div style={{ height: "3px", background: color }} />
      <div style={{ height: "2px" }} />
      <div style={{ height: "1px", background: color }} />
    </div>
  );
}
