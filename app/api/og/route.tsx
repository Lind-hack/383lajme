import { ImageResponse } from "next/og";
import { getCategoryColor } from "@/lib/category-colors";

/**
 * Branded social-card generator for articles that ship without an image.
 * Linked from generateMetadata on /article/[slug]; also usable ad hoc:
 *   /api/og?title=...&category=Sport
 * Uses next/og's default font (Noto Sans), which covers Albanian ë/ç.
 */


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get("title") ?? "383").slice(0, 160);
  const category = searchParams.get("category") ?? "";
  const accent = category ? getCategoryColor(category) : "#FF4422";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#F9F6F1",
          padding: 0,
        }}
      >
        {/* Accent spine */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 14,
            height: "100%",
            backgroundColor: accent,
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 64,
            paddingLeft: 84,
            paddingRight: 84,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#111111",
            }}
          >
            383
          </div>
          {category ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: accent,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: accent,
                  marginRight: 14,
                  display: "flex",
                }}
              />
              {category}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            paddingLeft: 84,
            paddingRight: 84,
            paddingBottom: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: title.length > 90 ? 52 : 62,
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              color: "#111111",
              lineClamp: 4,
            }}
          >
            {title}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingLeft: 84,
            paddingRight: 84,
            paddingBottom: 56,
          }}
        >
          <div
            style={{
              display: "flex",
              height: 6,
              width: 220,
              backgroundColor: accent,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontWeight: 600,
              color: "#6B6B6B",
            }}
          >
            383ks.com · lajme nga Kosova
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
