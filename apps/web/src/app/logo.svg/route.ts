import { wordmarkSvg } from "@rsos/config/logo";

/** Placeholder wordmark generated from the brand name in packages/config. */
export function GET() {
  return new Response(wordmarkSvg(), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" },
  });
}
