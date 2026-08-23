import { createHmac, randomBytes } from "node:crypto";

export type VisitReporterMode = "account" | "anonymous";

const processSecret = randomBytes(32).toString("hex");

export function resolveReporterMode(requestAnonymous: boolean | undefined, userId: string | undefined) {
  if (requestAnonymous === false && !userId) return null;
  return requestAnonymous === false && userId ? "account" : "anonymous";
}

export function hashReportIdentity({
  mode,
  userId,
  deviceId,
  forwarded,
  secret = process.env.VISIT_REPORT_SALT ?? process.env.CRON_SECRET ?? processSecret,
}: {
  mode: VisitReporterMode;
  userId?: string;
  deviceId?: string;
  forwarded: string;
  secret?: string;
}) {
  const identity = mode === "account" ? userId ?? "missing" : `${deviceId ?? "missing"}:${forwarded}`;
  return `${mode}:${createHmac("sha256", secret).update(identity).digest("hex")}`;
}

export function reporterModeFromHash(deviceHash: string | null | undefined): VisitReporterMode {
  return deviceHash?.startsWith("account:") ? "account" : "anonymous";
}

export function classifyCommunityReport(waitMinutes: number, officialMinutes: number | null) {
  const difference = officialMinutes === null ? null : Math.abs(waitMinutes - officialMinutes);
  const tolerance = officialMinutes === null ? null : Math.max(15, Math.round(officialMinutes * 1.5));
  const status = difference !== null && tolerance !== null && difference > tolerance ? "quarantined" as const : "accepted" as const;
  const confidence = status === "quarantined" ? "rejected_outlier" as const : officialMinutes === null ? "low" as const : difference! <= 8 ? "high" as const : "medium" as const;
  return { status, confidence };
}
