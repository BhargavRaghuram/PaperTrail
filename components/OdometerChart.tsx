"use client";
import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { TLEvent } from "@/lib/contracts";

type Pt = { x: number; y: number; km: number; date: string; drop: boolean };

/**
 * The forensic centerpiece: odometer reading plotted against time.
 * A healthy car climbs monotonically. A rolled-back one plunges —
 * and that plunge is drawn in danger red so the fraud is *seen*, not read.
 */
export function OdometerChart({ events, breakDates }: { events: TLEvent[]; breakDates: string[] }) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/[:]/g, "");

  const pts = events
    .filter((e) => typeof e.odometer_km === "number")
    .map((e) => ({ km: e.odometer_km as number, date: e.date }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (pts.length < 2) return null;

  const W = 640, H = 240;
  const padL = 8, padR = 12, padT = 20, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;

  const kms = pts.map((p) => p.km);
  const t = pts.map((p) => new Date(p.date).getTime());
  const minK = Math.min(...kms), maxK = Math.max(...kms);
  const minT = Math.min(...t), maxT = Math.max(...t);
  const spanK = Math.max(1, maxK - minK);
  const spanT = Math.max(1, maxT - minT);

  const nodes: Pt[] = pts.map((p, i) => ({
    x: padL + ((t[i] - minT) / spanT) * iw,
    y: padT + ih - ((p.km - minK) / spanK) * ih,
    km: p.km,
    date: p.date,
    drop: breakDates.includes(p.date),
  }));

  const line = nodes.map((n, i) => `${i === 0 ? "M" : "L"}${n.x.toFixed(1)} ${n.y.toFixed(1)}`).join(" ");
  const area = `${line} L${nodes[nodes.length - 1].x.toFixed(1)} ${(padT + ih).toFixed(1)} L${nodes[0].x.toFixed(1)} ${(padT + ih).toFixed(1)} Z`;

  // Any segment that goes DOWN over time is impossible — draw it red.
  const dropSegs = nodes.slice(1).map((n, i) => ({ a: nodes[i], b: n })).filter((s) => s.b.km < s.a.km);

  const fmtK = (k: number) => (k >= 1000 ? `${Math.round(k / 1000)}k` : `${k}`);
  const yTicks = [maxK, minK + spanK / 2, minK];

  return (
    <figure className="card" style={{ margin: 0, padding: "20px 20px 14px", overflow: "hidden" }}>
      <figcaption style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span className="eyebrow">Odometer · km over time</span>
        {dropSegs.length > 0 && (
          <span className="badge" style={{ color: "var(--danger)", background: "var(--danger-tint)" }}>
            reading fell {dropSegs.length}×
          </span>
        )}
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        aria-label={`Odometer readings from ${fmtK(pts[0].km)} to ${fmtK(pts[pts.length - 1].km)} kilometres over time`}>
        <defs>
          <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--iris)" stopOpacity="0.20" />
            <stop offset="100%" stopColor="var(--iris)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines + y labels */}
        {yTicks.map((k, i) => {
          const y = padT + ih - ((k - minK) / spanK) * ih;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--hair)" strokeWidth="1" strokeDasharray={i === 2 ? "0" : "2 4"} />
              <text x={W - padR} y={y - 4} textAnchor="end" fontFamily="var(--font-mono)" fontSize="10" fill="var(--ink-3)" letterSpacing="0.04em">
                {fmtK(k)}
              </text>
            </g>
          );
        })}

        {/* area + healthy line */}
        <path d={area} fill={`url(#area-${uid})`} />
        <motion.path
          d={line} fill="none" stroke="var(--iris)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          initial={reduce ? undefined : { pathLength: 0 }}
          whileInView={reduce ? undefined : { pathLength: 1 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* impossible (downward) segments, over-drawn in red */}
        {dropSegs.map((s, i) => (
          <line key={i} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y}
            stroke="var(--danger)" strokeWidth="3" strokeLinecap="round" />
        ))}

        {/* nodes */}
        {nodes.map((n, i) => (
          <g key={i}>
            {n.drop && !reduce && (
              <circle cx={n.x} cy={n.y} r="7" fill="none" stroke="var(--danger)" strokeWidth="2"
                style={{ transformOrigin: `${n.x}px ${n.y}px`, animation: "ping-fade 1.6s var(--ease-out) 1s 2" }} />
            )}
            <circle cx={n.x} cy={n.y} r={n.drop ? 5 : 3.5}
              fill={n.drop ? "var(--danger)" : "var(--surface)"}
              stroke={n.drop ? "var(--danger)" : "var(--iris)"} strokeWidth="2" />
            {n.drop && (
              <text x={n.x} y={n.y - 12} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fontWeight="600" fill="var(--danger)">
                −{fmtK(nodes[i - 1] ? nodes[i - 1].km - n.km : 0)}
              </text>
            )}
          </g>
        ))}

        {/* x labels: first + last year */}
        <text x={padL} y={H - 10} fontFamily="var(--font-mono)" fontSize="10" fill="var(--ink-3)" letterSpacing="0.04em">
          {pts[0].date.slice(0, 4)}
        </text>
        <text x={W - padR} y={H - 10} textAnchor="end" fontFamily="var(--font-mono)" fontSize="10" fill="var(--ink-3)" letterSpacing="0.04em">
          {pts[pts.length - 1].date.slice(0, 4)}
        </text>
      </svg>
    </figure>
  );
}
