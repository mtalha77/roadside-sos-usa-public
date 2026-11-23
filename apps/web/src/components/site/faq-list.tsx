import { ChevronDown } from "lucide-react";
import { JsonLd } from "./json-ld";

export type Faq = { id: string; q: string; a: string };

/**
 * Questions and answers as native disclosures (no JavaScript; answers stay in the page for search
 * engines and find-in-page) with FAQPage structured data.
 */
export function FaqList({ items, withSchema = true }: { items: Faq[]; withSchema?: boolean }) {
  return (
    <>
      <div className="divide-y rounded-2xl border bg-card">
        {items.map((f) => (
          <details key={f.id} id={f.id} className="group px-4">
            <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
              {f.q}
              <ChevronDown
                aria-hidden="true"
                className="size-5 shrink-0 transition-transform duration-200 group-open:rotate-180"
              />
            </summary>
            <p className="pb-4 text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
      {withSchema ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }}
        />
      ) : null}
    </>
  );
}
