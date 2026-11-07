interface Props {
  what: string;
  why?: string;
  catColor: string;
}

/**
 * The story in seconds, read before the body: what happened, and why when the
 * sources say. A ruled summary in the article's own type, not a boxed widget:
 * a hairline in the category colour opens it, labels sit in a narrow column
 * beside the text on wide screens and above it on phones (.ctx-card in globals).
 */
export default function ArticleContextCard({ what, why, catColor }: Props) {
  return (
    <dl
      className="ctx-card"
      style={{
        margin: "0 0 36px",
        padding: "18px 0 20px",
        borderTop: `2px solid ${catColor}`,
        borderBottom: "1px solid rgba(17,17,17,0.12)",
        ["--ctx-accent" as string]: `var(--theme-accent-ink, ${catColor})`,
      }}
    >
      <div className="ctx-row">
        <dt className="ctx-label">Çfarë ndodhi</dt>
        <dd className="ctx-what">{what}</dd>
      </div>
      {why && (
        <div className="ctx-row">
          <dt className="ctx-label">Pse ndodhi</dt>
          <dd className="ctx-why">{why}</dd>
        </div>
      )}
    </dl>
  );
}
