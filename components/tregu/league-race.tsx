"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtNum } from "@/lib/format";
import type { RacePoint } from "@/lib/tregu-leagues";

const PALETTE = ["#0047FF", "#E41E20", "#00A651", "#7C3AED", "#EC4899", "#0EA5E9", "#F97316", "#14B8A6"];
const PAD = { top: 16, right: 110, bottom: 26, left: 8 };

type Series = { name: string; isMe: boolean; values: number[]; color: string };

const shortDay = (iso: string) => {
  const [, month, day] = iso.split("-").map(Number);
  return `${day}.${String(month).padStart(2, "0")}`;
};

/**
 * The race: every member's closed profit, day by day, as lines that end in
 * their name. Yours is the thick gold one. This is the chart that makes a
 * league a rivalry: you see exactly when a friend pulled away and how close
 * the line above you is.
 */
export default function LeagueRace({ points, dark = false }: { points: RacePoint[]; dark?: boolean }) {
  // Draw at the container's real width, so text stays 12px and the chart
  // keeps one height instead of scaling up into a poster on wide screens.
  const frame = useRef<HTMLElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const H = W < 480 ? 190 : 220;
  const { series, days, min, max } = useMemo(() => {
    const byName = new Map<string, { isMe: boolean; values: Map<string, number> }>();
    const daySet = new Set<string>();
    for (const point of points) {
      daySet.add(point.day);
      const key = `${point.display_name}|${point.is_me}`;
      if (!byName.has(key)) byName.set(key, { isMe: point.is_me, values: new Map() });
      byName.get(key)!.values.set(point.day, Number(point.cumulative) || 0);
    }
    const days = [...daySet].sort();
    let colorIndex = 0;
    const series: Series[] = [...byName.entries()].map(([key, entry]) => ({
      name: key.split("|")[0],
      isMe: entry.isMe,
      values: days.map((day) => entry.values.get(day) ?? 0),
      color: entry.isMe ? "#F2C14E" : PALETTE[colorIndex++ % PALETTE.length],
    }));
    // Draw yours last, on top.
    series.sort((a, b) => Number(a.isMe) - Number(b.isMe));
    const all = series.flatMap((item) => item.values);
    return { series, days, min: Math.min(0, ...all), max: Math.max(1, ...all) };
  }, [points]);

  if (!series.length || !days.length) return null;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const span = max - min || 1;
  const x = (i: number) => PAD.left + (days.length === 1 ? plotW : (i / (days.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - ((v - min) / span) * plotH;

  // End labels: sorted by height, nudged apart so no two overlap.
  const labels = series
    .map((item) => ({ ...item, end: item.values[item.values.length - 1], y: y(item.values[item.values.length - 1]) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i += 1) {
    if (labels[i].y - labels[i - 1].y < 15) labels[i].y = labels[i - 1].y + 15;
  }

  const ink = dark ? "rgba(244,239,230,.62)" : "#6B6B6B";
  const grid = dark ? "rgba(244,239,230,.12)" : "rgba(17,17,17,.08)";

  return (
    <figure ref={frame} className="lrace" data-dark={dark || undefined}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Gara: ${labels.map((item) => `${item.name} ${fmtNum(item.end)}`).join(", ")}`}>
        <line x1={PAD.left} x2={PAD.left + plotW} y1={y(0)} y2={y(0)} stroke={grid} strokeWidth={1.5} strokeDasharray="4 6" />
        {series.map((item) => {
          const path = item.values.map((value, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");
          return (
            <g key={`${item.name}-${item.isMe}`}>
              <path
                d={days.length === 1 ? `M${PAD.left} ${y(0)} L${x(0)} ${y(item.values[0])}` : path}
                fill="none"
                stroke={item.color}
                strokeWidth={item.isMe ? 4 : 2.2}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={item.isMe ? 1 : 0.8}
                pathLength={1}
                className="lrace-line"
              />
              <circle cx={x(item.values.length - 1)} cy={y(item.values[item.values.length - 1])} r={item.isMe ? 5.5 : 3.5} fill={item.color} className="lrace-dot" />
            </g>
          );
        })}
        {labels.map((item) => (
          <text
            key={`label-${item.name}-${item.isMe}`}
            x={PAD.left + plotW + 12}
            y={item.y + 4}
            fontSize={item.isMe ? 13 : 12}
            fontWeight={item.isMe ? 800 : 700}
            fill={item.isMe ? (dark ? "#F2C14E" : "#8A6A12") : ink}
          >
            {item.isMe ? "Ti" : item.name} {item.end > 0 ? "+" : ""}{fmtNum(Math.round(item.end))}
          </text>
        ))}
        <text x={PAD.left} y={H - 6} fontSize={11} fill={ink}>{shortDay(days[0])}</text>
        {days.length > 1 && <text x={PAD.left + plotW} y={H - 6} fontSize={11} fill={ink} textAnchor="end">sot</text>}
      </svg>
    </figure>
  );
}
