import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REPO = "Lind-hack/383lajme";
const WORKFLOW_ID = "codex-cloud-news.yml";
const REF = "main";
const KOSOVO_TIME_ZONE = "Europe/Belgrade";
const TARGET_HOURS = [7, 9, 11, 13, 15, 17, 19, 21, 23];

type KosovoParts = {
  date: string;
  hour: number;
};

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const authHeader = request.headers.get("authorization") ?? "";

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is missing in Vercel production env." },
      { status: 500 },
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token =
    process.env.CODEX_PUSH_TOKEN ??
    process.env.GITHUB_PAT ??
    process.env.GITHUB_TOKEN ??
    "";

  if (!token) {
    return NextResponse.json(
      { error: "Missing CODEX_PUSH_TOKEN, GITHUB_PAT, or GITHUB_TOKEN in Vercel production env." },
      { status: 500 },
    );
  }

  const slotLabel = kosovoSlotLabel(new Date());
  if (!slotLabel) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Current Kosovo local hour is not a configured news slot.",
    });
  }

  const response = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "383-lajme-vercel-cron",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: REF,
        inputs: {
          cron_slot_label: slotLabel,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      {
        error: "GitHub workflow dispatch failed",
        status: response.status,
        detail: detail.slice(0, 500),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    workflow: WORKFLOW_ID,
    ref: REF,
    cron_slot_label: slotLabel,
  });
}

function kosovoSlotLabel(now: Date): string | null {
  const parts = kosovoParts(now);
  if (!TARGET_HOURS.includes(parts.hour)) {
    return null;
  }

  return `${parts.date} ${String(parts.hour).padStart(2, "0")}:00 Kosovo time`;
}

function kosovoParts(date: Date): KosovoParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: KOSOVO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
}
