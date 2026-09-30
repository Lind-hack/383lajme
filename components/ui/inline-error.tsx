// Inline error panel. Server-safe and purely presentational: the retry action is
// passed in, so a server component can render the failed state and a client
// component can hand it a working button.
//
// Every error on the site answers three questions, in this order:
//   1. what happened   -> title
//   2. why it happened -> detail
//   3. what to do now  -> action
// A message that only says "diçka shkoi keq" answers none of them and is not
// acceptable here. Raw database or fetch errors never reach this component.

import type { ReactNode } from "react";

type InlineErrorProps = {
  /** What happened, in the reader's words. Not an exception message. */
  title: string;
  /** Why it happened, and what it means for what they can see. */
  detail?: ReactNode;
  /** The way forward. Omit only when there genuinely is not one. */
  action?: ReactNode;
  /** `inline` sits inside a section; `panel` replaces one. */
  tone?: "inline" | "panel";
};

export default function InlineError({
  title,
  detail,
  action,
  tone = "inline",
}: InlineErrorProps) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
        background: tone === "panel" ? "#FFFFFF" : "#FDF8F2",
        border: "1px solid #F0D9AE",
        borderLeft: "4px solid #F59E0B",
        borderRadius: "12px",
        padding: tone === "panel" ? "24px" : "16px 18px",
        minHeight: tone === "panel" ? "160px" : undefined,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          background: "#F59E0B",
          color: "#FFFFFF",
          fontSize: "13px",
          fontWeight: 800,
          lineHeight: "20px",
          textAlign: "center",
          marginTop: "1px",
        }}
      >
        !
      </span>

      <div style={{ minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: "15px",
            fontWeight: 700,
            color: "#111111",
            lineHeight: 1.4,
          }}
        >
          {title}
        </p>

        {detail && (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "14px",
              color: "#5A5A5A",
              lineHeight: 1.55,
              maxWidth: "62ch",
            }}
          >
            {detail}
          </p>
        )}

        {action && <div style={{ marginTop: "12px" }}>{action}</div>}
      </div>
    </div>
  );
}

/** The standard retry control, so every retry on the site looks the same. */
export function RetryButton({
  onClick,
  label = "Provo përsëri",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: "44px",
        padding: "0 20px",
        border: "none",
        borderRadius: "100px",
        background: "#FF4422",
        color: "#FFFFFF",
        fontSize: "15px",
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}
