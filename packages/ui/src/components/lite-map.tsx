import { cn } from "../lib/cn";

export type LiteMapPoint = {
  id: string;
  lat: number;
  lng: number;
  kind: "request" | "provider" | "truck" | "destination" | "area";
  tone?: "neutral" | "warning" | "critical" | "success" | "info";
  label: string;
};

/**
 * Lightweight schematic map (SVG, no map provider, no JavaScript): points projected inside their
 * bounding box, with an optional route line and service-area circle. Used until a Google Maps key
 * exists, and for dense dashboards where a full map would be heavy.
 */
export function LiteMap({
  points,
  route,
  radius,
  className,
  label,
}: {
  points: LiteMapPoint[];
  route?: { from: { lat: number; lng: number }; to: { lat: number; lng: number } };
  radius?: { center: { lat: number; lng: number }; miles: number };
  className?: string;
  label: string;
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
      {points.map((p) => (
        <g key={p.id} transform={`translate(${x(p.lng)} ${y(p.lat)})`}>
          <title>{p.label}</title>
          {p.kind === "truck" ? (
            <g>
              <circle r="11" className="fill-background stroke-foreground" strokeWidth="2" />
              <path
                d="M-6 2h8V-3h3l3 3v2h-2M-3 2a1.5 1.5 0 1 0 0 .01M5 2a1.5 1.5 0 1 0 0 .01"
                className="fill-none stroke-foreground"
                strokeWidth="1.6"
              />
            </g>
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
          ) : (
            <g>
              <circle
                r={p.kind === "request" ? 8 : 6}
                className={cn(
                  tone[p.tone ?? (p.kind === "request" ? "critical" : "neutral")],
                  "stroke-background",
                )}
                strokeWidth="2"
              />
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}
