// Dev-only: the league emails with sample data, for design review.
// /tregu-preview/email?kind=overtake | reward | digest
import { buildDigestEmail, buildOvertakeEmail, buildRewardEmail } from "@/lib/tregu-league-emails";
import type { LeagueSnapshot } from "@/lib/tregu-email-kit";

const DAY = 86_400_000;

function sampleSnapshot(name: string, me: number): LeagueSnapshot {
  const names = ["Arta Krasniqi", "Blerim Gashi", "Dona Berisha", "Enis Hoxha", "Lind", "Fatlum Morina", "Gresa Shala"];
  const points = [186, 171, 164, 132, 120, 97, 64];
  const rows = names.map((n, i) => ({ place: i + 1, name: i + 1 === me ? "Lind" : n, points: points[i], me: i + 1 === me }));
  return {
    name,
    kind: "public",
    emblem: "/logos/premierleague.svg",
    color: "#360D3A",
    prizes: [125, 75, 40],
    starts_at: new Date(Date.now() - 2 * DAY).toISOString(),
    ends_at: new Date(Date.now() + 5 * DAY).toISOString(),
    members: 24,
    pot: 240,
    rows: rows.filter((r) => r.place <= 3 || Math.abs(r.place - me) <= 1),
    matches: [
      { slug: "demo", question: "Arsenal — Chelsea: kush fiton?", lock_at: new Date(Date.now() + 0.4 * DAY).toISOString(), options: [{ label: "Arsenal", points: 45 }, { label: "Barazim", points: 73 }, { label: "Chelsea", points: 82 }] },
      { slug: "demo", question: "Liverpool — Everton: kush fiton?", lock_at: new Date(Date.now() + 1.2 * DAY).toISOString(), options: [{ label: "Liverpool", points: 28 }, { label: "Barazim", points: 79 }, { label: "Everton", points: 91 }] },
    ],
  };
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const kind = new URL(request.url).searchParams.get("kind") ?? "overtake";
  const unsubscribe = "https://383ks.com/tregu";
  const email =
    kind === "reward"
      ? buildRewardEmail({ first: "Lind", rewards: [{ kind: "weekly", place: 1, prize: 250, league: null }, { kind: "league", place: 2, prize: 111, league: "Liga e Javës · Superliga" }] })
      : kind === "digest"
        ? buildDigestEmail({
            first: "Lind",
            leagues: [
              { snapshot: sampleSnapshot("Premier League me miqtë", 5), change: -1 },
              { snapshot: { ...sampleSnapshot("Liga e Javës · Superliga", 2), emblem: "🏀", color: "#F2C14E" }, change: 2 },
            ],
            events: [
              { kind: "overtaken", title: "Arta të kaloi", body: "Ra në #5 te Premier League me miqtë. 12 pikë të kthejnë vendin." },
              { kind: "climbed", title: "U ngjite në #2", body: "Te Liga e Javës · Superliga. Mbaje vendin." },
            ],
            openDuels: 1,
            unsubscribe,
          })
        : buildOvertakeEmail({
            first: "Lind",
            overtakes: [
              { actor: "Enis", league: "Premier League me miqtë", to: 5, gap: 12 },
              { actor: "Dona", league: "Liga e Javës · Superliga", to: 3, gap: 4 },
            ],
            snapshot: sampleSnapshot("Premier League me miqtë", 5),
            unsubscribe,
          });
  return new Response(email.html, { headers: { "Content-Type": "text/html; charset=utf-8", "X-Subject": encodeURIComponent(email.subject) } });
}
