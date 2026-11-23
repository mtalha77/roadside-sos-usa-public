"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  type Table as TanstackTable,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Input } from "./input";

export type { ColumnDef } from "@tanstack/react-table";

/** Table state a "saved view" stores. */
export type DataTableView = {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnVisibility: VisibilityState;
  globalFilter: string;
};

const emptyView: DataTableView = {
  sorting: [],
  columnFilters: [],
  columnVisibility: {},
  globalFilter: "",
};

/**
 * Saved views: named table states kept per user in localStorage (per browser).
 * Server-side saved views can replace the storage later without changing the table.
 */
const VIEWS_EVENT = "rsos:saved-views";
const emptyViews: Record<string, DataTableView> = {};
const viewsCache = new Map<string, { raw: string | null; value: Record<string, DataTableView> }>();

function readViews(key: string): Record<string, DataTableView> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return emptyViews; // storage unavailable (private mode)
  }
  const cached = viewsCache.get(key);
  if (cached && cached.raw === raw) return cached.value;
  const value = parseViews(raw);
  viewsCache.set(key, { raw, value });
  return value;
}

function parseViews(raw: string | null): Record<string, DataTableView> {
  if (!raw) return emptyViews;
  try {
    return JSON.parse(raw) as Record<string, DataTableView>;
  } catch {
    return emptyViews;
  }
}

function subscribeViews(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(VIEWS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(VIEWS_EVENT, onChange);
  };
}

export function useSavedViews(storageKey: string) {
  const views = useSyncExternalStore(
    subscribeViews,
    () => readViews(storageKey),
    () => emptyViews,
  );
  const persist = useCallback(
    (next: Record<string, DataTableView>) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore: views are just not persisted
      }
      window.dispatchEvent(new Event(VIEWS_EVENT));
    },
    [storageKey],
  );
  return {
    views,
    saveView: (name: string, view: DataTableView) => persist({ ...views, [name]: view }),
    deleteView: (name: string) => {
      const { [name]: _removed, ...rest } = views;
      persist(rest);
    },
  };
}

export type DataTableLabels = {
  search: string;
  columns: string;
  selectAll: string;
  selectRow: string;
  noResults: string;
  previous: string;
  next: string;
  page: (page: number, pages: number) => string;
  selected: (count: number) => string;
  sortBy: (column: string) => string;
};

export const defaultDataTableLabels: DataTableLabels = {
  search: "Search",
  columns: "Columns",
  selectAll: "Select all rows",
  selectRow: "Select row",
  noResults: "No results",
  previous: "Previous page",
  next: "Next page",
  page: (p, n) => `Page ${p} of ${n}`,
  selected: (c) => `${c} selected`,
  sortBy: (c) => `Sort by ${c}`,
};

export type DataTableProps<T> = {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  /** Accessible table name. */
  caption: string;
  /** "paginate" for normal lists; "virtual" renders only visible rows (10,000+ rows). */
  mode?: "paginate" | "virtual";
  pageSize?: number;
  /** Height of the scroll area in virtual mode. */
  height?: number;
  rowHeight?: number;
  enableSelection?: boolean;
  onSelectionChange?: (rows: T[]) => void;
  getRowId?: (row: T, index: number) => string;
  view?: DataTableView;
  onViewChange?: (view: DataTableView) => void;
  toolbar?: ReactNode;
  labels?: Partial<DataTableLabels>;
  onRowClick?: (row: T) => void;
};

export function DataTable<T>({
  data,
  columns,
  caption,
  mode = "paginate",
  pageSize = 25,
  height = 560,
  rowHeight = 52,
  enableSelection = false,
  onSelectionChange,
  getRowId,
  view = emptyView,
  onViewChange,
  toolbar,
  labels: labelOverrides,
  onRowClick,
}: DataTableProps<T>) {
  const labels = { ...defaultDataTableLabels, ...labelOverrides };
  const [sorting, setSorting] = useState<SortingState>(view.sorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(view.columnFilters);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(view.columnVisibility);
  const [globalFilter, setGlobalFilter] = useState(view.globalFilter);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  useEffect(() => {
    setSorting(view.sorting);
    setColumnFilters(view.columnFilters);
    setColumnVisibility(view.columnVisibility);
    setGlobalFilter(view.globalFilter);
  }, [view]);

  useEffect(() => {
    onViewChange?.({ sorting, columnFilters, columnVisibility, globalFilter });
  }, [sorting, columnFilters, columnVisibility, globalFilter, onViewChange]);

  const selectionColumn: ColumnDef<T, unknown> = {
    id: "_select",
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => (
      <Checkbox
        aria-label={labels.selectAll}
        checked={
          table.getIsAllRowsSelected()
            ? true
            : table.getIsSomeRowsSelected()
              ? "indeterminate"
              : false
        }
        onCheckedChange={(v) => table.toggleAllRowsSelected(v === true)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label={labels.selectRow}
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(v === true)}
        onClick={(e) => e.stopPropagation()}
      />
    ),
    size: 48,
  };

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns a mutable instance; React Compiler skipping this component is expected.
  const table = useReactTable<T>({
    data,
    columns: enableSelection ? [selectionColumn, ...columns] : columns,
    state: { sorting, columnFilters, columnVisibility, globalFilter, rowSelection },
    getRowId,
    enableRowSelection: enableSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(mode === "paginate"
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageSize, pageIndex: 0 } },
        }
      : {}),
  });

  useEffect(() => {
    onSelectionChange?.(table.getSelectedRowModel().rows.map((r) => r.original));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notify only when the selection changes
  }, [rowSelection]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={labels.search}
          placeholder={labels.search}
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
          type="search"
        />
        {toolbar}
        <div className="ml-auto flex items-center gap-2">
          {enableSelection && Object.keys(rowSelection).length > 0 ? (
            <span className="text-sm text-muted-foreground tabular-nums" role="status">
              {labels.selected(Object.keys(rowSelection).length)}
            </span>
          ) : null}
          <ColumnMenu table={table} label={labels.columns} />
        </div>
      </div>
      {mode === "virtual" ? (
        <VirtualBody
          table={table}
          caption={caption}
          height={height}
          rowHeight={rowHeight}
          labels={labels}
          onRowClick={onRowClick}
        />
      ) : (
        <PagedBody table={table} caption={caption} labels={labels} onRowClick={onRowClick} />
      )}
    </div>
  );
}

function ColumnMenu<T>({ table, label }: { table: TanstackTable<T>; label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" icon={<Columns3 aria-hidden="true" />}>
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {table
          .getAllLeafColumns()
          .filter((c) => c.getCanHide())
          .map((c) => (
            <DropdownMenuCheckboxItem
              key={c.id}
              checked={c.getIsVisible()}
              onCheckedChange={(v) => c.toggleVisibility(v === true)}
              onSelect={(e) => e.preventDefault()}
            >
              {typeof c.columnDef.header === "string" ? c.columnDef.header : c.id}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HeaderRow<T>({ table, labels }: { table: TanstackTable<T>; labels: DataTableLabels }) {
  return (
    <>
      {table.getHeaderGroups().map((group) => (
        <tr key={group.id}>
          {group.headers.map((header) => {
            const sorted = header.column.getIsSorted();
            const name =
              typeof header.column.columnDef.header === "string"
                ? header.column.columnDef.header
                : header.id;
            return (
              <th
                key={header.id}
                scope="col"
                aria-sort={
                  sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                }
                className="h-12 bg-muted px-3 text-left text-sm font-semibold whitespace-nowrap text-muted-foreground"
                style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
              >
                {header.isPlaceholder ? null : header.column.getCanSort() ? (
                  <button
                    type="button"
                    onClick={header.column.getToggleSortingHandler()}
                    aria-label={labels.sortBy(name)}
                    className="-mx-2 inline-flex min-h-10 cursor-pointer items-center gap-1 rounded-md px-2 hover:bg-accent hover:text-foreground"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {sorted === "asc" ? (
                      <ArrowUp aria-hidden="true" className="size-4" />
                    ) : sorted === "desc" ? (
                      <ArrowDown aria-hidden="true" className="size-4" />
                    ) : (
                      <ArrowUpDown aria-hidden="true" className="size-4 opacity-50" />
                    )}
                  </button>
                ) : (
                  flexRender(header.column.columnDef.header, header.getContext())
                )}
              </th>
            );
          })}
        </tr>
      ))}
    </>
  );
}

const rowClass =
  "border-b transition-colors duration-150 hover:bg-accent/60 data-[selected=true]:bg-info-subtle";

function PagedBody<T>({
  table,
  caption,
  labels,
  onRowClick,
}: {
  table: TanstackTable<T>;
  caption: string;
  labels: DataTableLabels;
  onRowClick?: (row: T) => void;
}) {
  const rows = table.getRowModel().rows;
  return (
    <>
      <div className="max-h-[70vh] overflow-auto rounded-xl border">
        <table className="w-full border-collapse text-left tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10">
            <HeaderRow table={table} labels={labels} />
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="p-8 text-center text-muted-foreground"
                >
                  {labels.noResults}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  data-selected={row.getIsSelected()}
                  className={cn(rowClass, onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="h-13 px-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground tabular-nums">
          {labels.page(
            table.getState().pagination.pageIndex + 1,
            Math.max(1, table.getPageCount()),
          )}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {labels.previous}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {labels.next}
          </Button>
        </div>
      </div>
    </>
  );
}

function VirtualBody<T>({
  table,
  caption,
  height,
  rowHeight,
  labels,
  onRowClick,
}: {
  table: TanstackTable<T>;
  caption: string;
  height: number;
  rowHeight: number;
  labels: DataTableLabels;
  onRowClick?: (row: T) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual returns a mutable instance; React Compiler skipping this component is expected.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
    initialRect: { width: 1024, height },
  });
  const items = virtualizer.getVirtualItems();
  const padTop = items[0]?.start ?? 0;
  const padBottom = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0);
  const cols = table.getVisibleLeafColumns().length;
  return (
    <div
      ref={parentRef}
      className="overflow-auto rounded-xl border"
      style={{ height }}
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table
        className="w-full border-collapse text-left tabular-nums"
        aria-rowcount={rows.length + 1}
      >
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10">
          <HeaderRow table={table} labels={labels} />
        </thead>
        <tbody>
          {padTop > 0 ? (
            <tr aria-hidden="true">
              <td colSpan={cols} style={{ height: padTop, padding: 0 }} />
            </tr>
          ) : null}
          {items.map((item) => {
            const row = rows[item.index]!;
            return (
              <tr
                key={row.id}
                aria-rowindex={item.index + 2}
                data-selected={row.getIsSelected()}
                className={cn(rowClass, onRowClick && "cursor-pointer")}
                style={{ height: rowHeight }}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
          {padBottom > 0 ? (
            <tr aria-hidden="true">
              <td colSpan={cols} style={{ height: padBottom, padding: 0 }} />
            </tr>
          ) : null}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols} className="p-8 text-center text-muted-foreground">
                {labels.noResults}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
