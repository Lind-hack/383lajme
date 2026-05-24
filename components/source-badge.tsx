const BIAS_DOT: Record<string, { color: string; label: string }> = {
  neutral:      { color: "#9CA3AF", label: "Neutral" },
  "pro-kosovo": { color: "#00A651", label: "Pro-Kosovë" },
  critical:     { color: "#E41E20", label: "Kritik" },
  hostile:      { color: "#E41E20", label: "Burim Serb" },
};

interface SourceBadgeProps {
  source: string;
  flag: string;
  size?: "sm" | "md";
  bias?: "neutral" | "pro-kosovo" | "critical" | "hostile";
  url?: string;
}

export default function SourceBadge({ source, flag, size = "md", bias, url }: SourceBadgeProps) {
  const fontSize = size === "sm" ? "11px" : "12px";
  const padding = size === "sm" ? "3px 8px" : "4px 10px";
  const dot = bias ? BIAS_DOT[bias] : null;

  const badge = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        background: "rgba(0,0,0,0.05)",
        border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: "100px",
        padding,
        fontSize,
        fontWeight: 600,
        color: "#6B6B6B",
        letterSpacing: "0.04em",
      }}
    >
      <span>{flag}</span>
      <span>{source}</span>
      {dot && (
        <span
          title={dot.label}
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: dot.color,
            flexShrink: 0,
            cursor: "help",
          }}
        />
      )}
    </span>
  );

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none" }}
        onClick={(e) => e.stopPropagation()}
        title={`Lexo artikullin origjinal në ${source}`}
      >
        {badge}
      </a>
    );
  }

  return badge;
}
