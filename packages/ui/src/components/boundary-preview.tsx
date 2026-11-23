import { cn } from "../lib/cn";

type Ring = [number, number][];
type Geometry =
  { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
export type BoundaryFeature = { geometry: Geometry; properties?: Record<string, unknown> };

export type BoundaryPreviewProps = {
  features: BoundaryFeature[];
  /** Optional points to plot, e.g. the market centre. [lat, lng]. */
  points?: { lat: number; lng: number; label: string }[];
  label: string;
  className?: string;
};

function rings(g: Geometry): Ring[] {
  return g.type === "Polygon" ? g.coordinates : g.coordinates.flat();
}

/**
 * Draws market boundaries as SVG without a map provider (admin previews, Storybook).
 * Equirectangular projection corrected by the cosine of the mid latitude.
 */
export function BoundaryPreview({ features, points = [], label, className }: BoundaryPreviewProps) {
  const all = features.flatMap((f) => rings(f.geometry)).flat();
  const lngs = all.map((c) => c[0]);
  const lats = all.map((c) => c[1]);
  const [minX, maxX, minY, maxY] = [
    Math.min(...lngs),
    Math.max(...lngs),
    Math.min(...lats),
    Math.max(...lats),
  ];
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const w = (maxX - minX) * k;
  const h = maxY - minY;
  const size = 400;
  const scale = size / Math.max(w, h);
  const project = (lng: number, lat: number) => [
    ((lng - minX) * k * scale).toFixed(1),
    ((maxY - lat) * scale).toFixed(1),
  ];
  const d = features
    .flatMap((f) => rings(f.geometry))
    .map((ring) => "M" + ring.map(([x, y]) => project(x, y).join(",")).join("L") + "Z")
    .join("");
  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <svg
        viewBox={`-8 -8 ${w * scale + 16} ${h * scale + 16}`}
        role="img"
        aria-label={label}
        className="w-full rounded-xl border bg-surface"
      >
        <path
          d={d}
          className="fill-info-subtle stroke-info-strong"
          strokeWidth={1.5}
          strokeLinejoin="round"
          fillRule="evenodd"
        />
        {points.map((p) => {
          const [x, y] = project(p.lng, p.lat);
          return (
            <circle
              key={p.label}
              cx={x}
              cy={y}
              r={5}
              className="fill-signal stroke-foreground"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>
      <figcaption className="text-sm text-muted-foreground">{label}</figcaption>
    </figure>
  );
}
