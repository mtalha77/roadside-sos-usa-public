"use client";

// THROWAWAY (RSOS-033 proof): pulls a large library into the home page to break the JS budget.
import { useReactTable, getCoreRowModel } from "@tanstack/react-table";
import { z } from "zod";

const Row = z.object({ id: z.string(), n: z.number() });

export function BudgetBreaker() {
  const table = useReactTable({
    data: [Row.parse({ id: "a", n: 1 })],
    columns: [{ accessorKey: "id" }],
    getCoreRowModel: getCoreRowModel(),
  });
  return <span hidden>{table.getRowModel().rows.length}</span>;
}
