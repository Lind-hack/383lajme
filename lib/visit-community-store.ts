export type VisitCommunityRow = {
  crossing_id: string;
  direction: string;
  wait_minutes: number;
  status: "accepted" | "quarantined";
  device_hash: string;
  created_at: string;
};

declare global {
  var __visitCommunityReports: VisitCommunityRow[] | undefined;
}

const reports = globalThis.__visitCommunityReports ?? [];
globalThis.__visitCommunityReports = reports;

function prune() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  const active = reports.filter((report) => Date.parse(report.created_at) >= cutoff);
  reports.splice(0, reports.length, ...active);
}

export function addMemoryReport(report: VisitCommunityRow) {
  prune();
  reports.push(report);
}

export function getAcceptedMemoryReports() {
  prune();
  return reports.filter((report) => report.status === "accepted");
}

export function hasRecentMemoryReport(deviceHash: string) {
  prune();
  const cutoff = Date.now() - 10 * 60 * 1000;
  return reports.some((report) => report.device_hash === deviceHash && Date.parse(report.created_at) >= cutoff);
}
