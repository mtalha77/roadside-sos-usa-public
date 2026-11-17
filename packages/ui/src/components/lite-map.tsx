import { cn } from "../lib/cn";

export type LiteMapPoint = {
  id: string;
  lat: number;
  lng: number;
  kind: "request" | "provider" | "truck" | "destination" | "area";
  tone?: "neutral" | "warning" | "critical" | "success" | "info";
  label: string;
};

/** A pin: a teardrop with a hole, its tip on the point. */
const PIN = "M0 0C-2-6-9-10-9-17a9 9 0 1 1 18 0C9-10 2-6 0 0Z";
const TRUCK = "M-6 2h8V-3h3l3 3v2h-2M-3 2a1.5 1.5 0 1 0 0 .01M5 2a1.5 1.5 0 1 0 0 .01";

function Truck() {
  return (
    <g>
      <circle r="11" className="fill-background stroke-foreground" strokeWidth="2" />
      <path d={TRUCK} className="fill-none stroke-foreground" strokeWidth="1.6" />
    </g>
  );
}

/**
 * The placeholder map (SVG, no map provider, no JavaScript): our tokens in light and dark, a grid
 * with simple vector streets, custom pins projected from latitude and longitude, an optional route
 * with a truck driving along it (still when reduced motion is on) and a service-area circle. The
 * map everywhere while Google Maps is off (owner scope change, batch 4), and for dense dashboards.
 */
export function LiteMap({
  points,
  route,
  radius,
  className,
  label,
  animate = true,
}: {
  points: LiteMapPoint[];
  route?: { from: { lat: number; lng: number }; to: { lat: number; lng: number } };
  radius?: { center: { lat: number; lng: number }; miles: number };
  className?: string;
  label: string;
  /** Drive a truck along the route (only with a route; never with reduced motion). */
  animate?: boolean;
}) {
  const all = [
    ...points,
    ...(route ? [route.from, route.to] : []),
    ...(radius ? [radius.center] : []),
  ];
  const pad = radius ? radius.miles / 60 : 0.02;
  const lats = all.map((p) => p.lat);
  const lngs = all.map((p) => p.lng);
  const minLat = Math.min(...lats, 90) - pad;
  const maxLat = Math.max(...lats, -90) + pad;
  const minLng = Math.min(...lngs, 180) - pad;
  const maxLng = Math.max(...lngs, -180) + pad;
  const W = 400;
  const H = 260;
  const spanLat = Math.max(maxLat - minLat, 0.01);
  const spanLng = Math.max(maxLng - minLng, 0.01);
  const x = (lng: number) => ((lng - minLng) / spanLng) * W;
  const y = (lat: number) => H - ((lat - minLat) / spanLat) * H;
  const tone = {
    neutral: "fill-foreground",
    warning: "fill-warning",
    critical: "fill-critical",
    success: "fill-success",
    info: "fill-info",
  } as const;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      className={cn("h-auto w-full rounded-2xl border bg-muted", className)}
    >
      <defs>
        <pattern id="lm-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" className="fill-none stroke-border" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#lm-grid)" />
      <g aria-hidden="true" className="fill-none stroke-background" strokeLinecap="round">
        <path d="M0 70H400M0 190H400M90 0V260M300 0V260" strokeWidth="7" />
        <path d="M0 130H400M200 0V260M30 0V260M370 0V260" strokeWidth="4" />
        <path d="M-10 250L410 20" strokeWidth="11" />
        <path
          d="M-10 250L410 20"
          strokeWidth="1.5"
          strokeDasharray="10 10"
          className="stroke-border"
        />
      </g>
      {radius ? (
        <circle
          cx={x(radius.center.lng)}
          cy={y(radius.center.lat)}
          r={(radius.miles / 69 / spanLat) * H}
          className="fill-info/10 stroke-info"
          strokeDasharray="6 4"
          strokeWidth="2"
        />
      ) : null}
      {route ? (
        <line
          x1={x(route.from.lng)}
          y1={y(route.from.lat)}
          x2={x(route.to.lng)}
          y2={y(route.to.lat)}
          className="stroke-info"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="2 8"
        />
      ) : null}
      {route && animate ? (
        <g className="motion-reduce:hidden" aria-hidden="true">
          <Truck />
          <animateMotion
            dur="6s"
            repeatCount="indefinite"
            path={`M${x(route.to.lng)} ${y(route.to.lat)}L${x(route.from.lng)} ${y(route.from.lat)}`}
          />
        </g>
      ) : null}
      {points.map((p) => (
        <g key={p.id} transform={`translate(${x(p.lng)} ${y(p.lat)})`}>
          <title>{p.label}</title>
          {p.kind === "truck" ? (
            <Truck />
          ) : p.kind === "destination" ? (
            <rect
              x="-6"
              y="-6"
              width="12"
              height="12"
              rx="2"
              className={tone[p.tone ?? "neutral"]}
            />
          ) : p.kind === "area" ? (
            <text textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {p.label}
            </text>
          ) : p.kind === "request" ? (
            <g>
              <path
                d={PIN}
                className={cn(tone[p.tone ?? "critical"], "stroke-background")}
                strokeWidth="2"
              />
              <circle cy="-17" r="3.5" className="fill-background" />
            </g>
          ) : (
            <circle
              r="6"
              className={cn(tone[p.tone ?? "neutral"], "stroke-background")}
              strokeWidth="2"
            />
          )}
        </g>
      ))}
    </svg>
  );
}
