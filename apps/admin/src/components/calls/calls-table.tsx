"use client";

import { Badge } from "@rsos/ui/badge";
import { type ColumnDef, DataTable } from "@rsos/ui/data-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

export type CallView = {
  id: string;
  at: number;
  time: string;
  market: string;
  direction: string;
  outcome: string;
  outcomeLabel: string;
  from: string;
  to: string;
  duration: string;
  requestId: string | null;
  requestCode: string | null;
};

const TONE: Record<string, "critical" | "warning" | "success" | "neutral"> = {
  missed: "critical",
  voicemail: "warning",
  failed: "critical",
  busy: "warning",
  answered: "success",
  completed: "success",
};

/** The call log as a sortable table (36px rows, sticky header, virtual past 100 rows). */
export function CallsTable({ rows, labels }: { rows: CallView[]; labels: Record<string, string> }) {
  const router = useRouter();
  const columns = useMemo<ColumnDef<CallView, unknown>[]>(
    () => [
      { accessorKey: "at", header: labels.time, cell: ({ row }) => row.original.time },
      { accessorKey: "direction", header: labels.direction },
      {
        accessorKey: "outcome",
        header: labels.outcome,
        cell: ({ row }) => (
          <Badge tone={TONE[row.original.outcome] ?? "neutral"}>{row.original.outcomeLabel}</Badge>
        ),
      },
      { accessorKey: "from", header: labels.from },
      { accessorKey: "to", header: labels.to },
      { accessorKey: "duration", header: labels.duration },
      { accessorKey: "market", header: labels.market },
      {
        accessorKey: "requestCode",
        header: labels.request,
        cell: ({ row }) =>
          row.original.requestId ? (
            <Link
              href={`/inbox?id=${row.original.requestId}`}
              className="underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.requestCode}
            </Link>
          ) : (
            "–"
          ),
      },
    ],
    [labels],
  );
  return (
    <DataTable
      data={rows}
      columns={columns}
      caption={labels.caption!}
      mode={rows.length > 100 ? "virtual" : "paginate"}
      pageSize={50}
      rowHeight={36}
      height={640}
      getRowId={(r) => r.id}
      onRowClick={(r) => (r.requestId ? router.push(`/inbox?id=${r.requestId}`) : undefined)}
      labels={{
        search: labels.search!,
        columns: labels.columns!,
        noResults: labels.empty!,
        previous: labels.previous!,
        next: labels.next!,
        page: (p, n) => labels.page!.replace("{page}", String(p)).replace("{pages}", String(n)),
        sortBy: (c) => labels.sortBy!.replace("{column}", c),
      }}
    />
  );
}
