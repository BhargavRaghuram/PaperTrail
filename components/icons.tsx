import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 18, height: 18, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const, "aria-hidden": true, ...p,
});

export const AlertTriangle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M10.3 3.7 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
);

export const ArrowDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></svg>
);

export const Printer = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" rx="1" /></svg>
);

export const Check = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M20 6 9 17l-5-5" /></svg>
);

export const Wrench = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.3-.6-.6-2.3 2.4-2.6Z" /></svg>
);

export const Shield = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" /></svg>
);

export const Dot = ({ color = "currentColor", size = 8 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 8 8" aria-hidden><circle cx="4" cy="4" r="4" fill={color} /></svg>
);
