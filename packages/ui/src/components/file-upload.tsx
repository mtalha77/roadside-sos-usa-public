"use client";

import { FileUp, X } from "lucide-react";
import { type DragEvent, useId, useRef, useState } from "react";
import { cn } from "../lib/cn";

export type FileUploadProps = {
  /** Accepted types, e.g. "image/*,application/pdf". */
  accept?: string;
  multiple?: boolean;
  /** Maximum size per file in bytes. */
  maxSize?: number;
  /** On phones, open the camera directly ("environment" = back camera). */
  capture?: "user" | "environment";
  label: string;
  hint?: string;
  onFilesChange?: (files: File[]) => void;
  /** Called with the names of rejected files and why. */
  onReject?: (rejected: { name: string; reason: "type" | "size" }[]) => void;
  removeLabel?: (name: string) => string;
};

function accepts(file: File, accept?: string) {
  if (!accept) return true;
  return accept.split(",").some((rule) => {
    const r = rule.trim();
    if (r.endsWith("/*")) return file.type.startsWith(r.slice(0, -1));
    if (r.startsWith(".")) return file.name.toLowerCase().endsWith(r.toLowerCase());
    return file.type === r;
  });
}

/** Drag and drop or tap to choose; keyboard users press the button. Validates type and size. */
export function FileUpload({
  accept,
  multiple,
  maxSize,
  capture,
  label,
  hint,
  onFilesChange,
  onReject,
  removeLabel = (n) => `Remove ${n}`,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  function add(list: FileList | File[]) {
    const incoming = Array.from(list);
    const rejected: { name: string; reason: "type" | "size" }[] = [];
    const ok = incoming.filter((f) => {
      if (!accepts(f, accept)) return (rejected.push({ name: f.name, reason: "type" }), false);
      if (maxSize && f.size > maxSize)
        return (rejected.push({ name: f.name, reason: "size" }), false);
      return true;
    });
    if (rejected.length) onReject?.(rejected);
    const next = multiple ? [...files, ...ok] : ok.slice(0, 1);
    setFiles(next);
    onFilesChange?.(next);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    add(e.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-input bg-surface p-6 text-center transition-colors duration-150",
          dragging && "border-ring bg-info-subtle",
        )}
      >
        <FileUp aria-hidden="true" className="size-8 text-muted-foreground" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="min-h-touch rounded-lg px-4 font-semibold underline underline-offset-4"
        >
          {label}
        </button>
        {hint ? (
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        ) : null}
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          capture={capture}
          aria-label={label}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => e.target.files && add(e.target.files)}
        />
      </div>
      {files.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {files.map((f) => (
            <li
              key={`${f.name}-${f.size}`}
              className="flex items-center justify-between gap-3 rounded-lg border bg-surface pl-4"
            >
              <span className="truncate text-sm">{f.name}</span>
              <button
                type="button"
                aria-label={removeLabel(f.name)}
                onClick={() => {
                  const next = files.filter((x) => x !== f);
                  setFiles(next);
                  onFilesChange?.(next);
                }}
                className="grid min-h-touch min-w-touch place-items-center rounded-lg hover:bg-accent"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
