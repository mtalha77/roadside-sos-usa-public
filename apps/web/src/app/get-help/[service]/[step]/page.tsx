import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GetHelpPage, { generateMetadata as meta } from "../../page";

export const dynamic = "force-dynamic";

const Steps = new Set(["problem", "location", "details"]);

export async function generateMetadata(): Promise<Metadata> {
  return meta();
}

/** /get-help/<service>/<step> (RSOS-116): the same flow, with the service and step in the URL. */
export default async function GetHelpStep({
  params,
  searchParams,
}: {
  params: Promise<{ service: string; step: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ service, step }, sp] = await Promise.all([params, searchParams]);
  if (!/^[a-z-]{2,40}$/.test(service) || !Steps.has(step)) notFound();
  return GetHelpPage({
    searchParams: Promise.resolve({ ...sp, __service: service, __step: step }),
  });
}
