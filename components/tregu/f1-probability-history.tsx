"use client";

type HistoryPoint = { createdAt: string; probabilities: Record<string, number>; lap?: number; status?: string };
type Driver = { key: string; label: string; team: string; probability: number };

export default function F1ProbabilityHistory({ drivers, history }: { drivers: Driver[]; history: HistoryPoint[] }) {
  if (history.length < 2) return <div className="mb-5 rounded-xl border border-white/10 bg-[#15171b] p-4 text-sm text-zinc-400">Nuk u ruajtën vektorë live për këtë garë. Historia e gjasave nuk mund të rikrijohet pa të dhëna të verifikuara.</div>;
  const latest = history.at(-1)?.probabilities ?? {};
  const leaders = [...drivers].sort((a, b) => Number(latest[b.key] ?? b.probability) - Number(latest[a.key] ?? a.probability)).slice(0, 10);
  const last = Math.max(history.length - 1, 1);
  return <div className="mb-5"><div className="mb-2 flex items-center justify-between"><h3 className="font-bold">Historia e gjasave</h3><span className="font-mono text-[11px] text-zinc-500">{history.length} vektorë të ruajtur</span></div><div className="h-64 overflow-hidden rounded-xl border border-white/10 bg-[#15171b] p-3"><svg viewBox="0 0 1000 300" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Grafiku historik i gjasave"><line x1="0" x2="1000" y1="150" y2="150" stroke="rgba(255,255,255,.1)" strokeDasharray="8 8"/>{leaders.map((driver, driverIndex) => <polyline key={driver.key} points={history.map((point, index) => `${index / last * 1000},${300 - Math.max(0, Math.min(1, Number(point.probabilities[driver.key] ?? 0))) * 280 - 10}`).join(" ")} fill="none" stroke={["#ff8000", "#e8002d", "#27f4d2", "#3671c6", "#64c4ff", "#229971", "#b8b8b8", "#ff87bc", "#b6babd", "#d7aa33"][driverIndex]} strokeWidth="4" vectorEffect="non-scaling-stroke" />)}</svg></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{leaders.map((driver) => <span key={driver.key} className="font-mono text-[10px] text-zinc-400">{driver.key}</span>)}</div></div>;
}
