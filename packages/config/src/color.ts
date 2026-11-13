/** OKLCH colour math for contrast checks and hex output (no dependencies). */
export type Oklch = { l: number; c: number; h: number; alpha?: number };

export function parseOklch(value: string): Oklch {
  const m = /^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/.exec(
    value.trim(),
  );
  if (!m) throw new Error(`Not an oklch() colour: ${value}`);
  const l = Number(m[1]);
  return {
    l: l > 1 ? l / 100 : l,
    c: Number(m[2]),
    h: Number(m[3]),
    alpha: m[4] ? Number(m[4]) : 1,
  };
}

/** OKLCH -> linear sRGB (clamped to the sRGB gamut). */
export function oklchToLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

export function relativeLuminance(color: string): number {
  const [r, g, b] = oklchToLinearSrgb(parseOklch(color));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** Hex for places that cannot use CSS variables (generated icons, browser theme-color, emails). */
export function toHex(color: string): string {
  const encode = (x: number) => {
    const v = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${oklchToLinearSrgb(parseOklch(color)).map(encode).join("")}`;
}
