interface Props {
  what: string;
  why?: string;
  catColor: string;
  catBg: string;
}

function Line({ label, text, catColor, lead }: { label: string; text: string; catColor: string; lead?: boolean }) {
  return (
    <div>
      <dt style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.04em", color: `var(--theme-accent-ink, ${catColor})`, margin: "0 0 4px" }}>
        {label}
      </dt>
      <dd style={{ margin: 0, fontSize: lead ? "19px" : "17px", fontWeight: lead ? 500 : 400, lineHeight: 1.55, color: "#111111" }}>
        {text}
      </dd>
    </div>
  );
}

/** The story in seconds, read before the body: what happened, and why when the sources say. */
export default function ArticleContextCard({ what, why, catColor, catBg }: Props) {
  return (
    <dl style={{ display: "grid", gap: "16px", margin: "0 0 32px", padding: "20px 22px", borderRadius: "var(--radius-sm)", background: catBg }}>
      <Line label="Çfarë ndodhi" text={what} catColor={catColor} lead />
      {why && <Line label="Pse ndodhi" text={why} catColor={catColor} />}
    </dl>
  );
}
