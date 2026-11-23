"use client";

import { ChevronsRight, Check } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { cn } from "../lib/cn";

export type SwipeToConfirmProps = {
  label: string;
  /** Instruction for screen readers and keyboard users. */
  instructions?: string;
  confirmedLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
};

/**
 * Slide the handle to the end to confirm a consequential action (accept a job, mark arrived).
 * Keyboard and screen reader users press Enter or Space on the handle instead.
 */
export function SwipeToConfirm({
  label,
  instructions = "Slide to the end, or press Enter, to confirm",
  confirmedLabel = "Confirmed",
  onConfirm,
  disabled,
}: SwipeToConfirmProps) {
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const HANDLE = 56;

  const max = () => (track.current?.clientWidth ?? 0) - HANDLE - 8;
  const confirm = () => {
    if (confirmed || disabled) return;
    setConfirmed(true);
    setOffset(max());
    onConfirm();
  };

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (disabled || confirmed) return;
    start.current = e.clientX - offset;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (start.current === null) return;
    setOffset(Math.min(max(), Math.max(0, e.clientX - start.current)));
  }
  function onPointerUp() {
    if (start.current === null) return;
    start.current = null;
    setDragging(false);
    if (offset >= max() * 0.9) confirm();
    else setOffset(0);
  }
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      confirm();
    }
  }

  return (
    <div
      ref={track}
      className={cn(
        "relative flex h-16 w-full items-center overflow-hidden rounded-full p-1 select-none",
        confirmed ? "bg-success" : "bg-muted",
        disabled && "cursor-not-allowed",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 grid place-items-center text-base font-semibold",
          confirmed ? "text-success-foreground" : "text-muted-foreground",
        )}
      >
        {confirmed ? confirmedLabel : label}
      </span>
      <button
        type="button"
        aria-label={confirmed ? confirmedLabel : `${label}. ${instructions}`}
        disabled={disabled || confirmed}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        style={{ transform: `translateX(${offset}px)` }}
        className={cn(
          "relative z-10 grid size-14 cursor-grab touch-none place-items-center rounded-full shadow-md active:cursor-grabbing",
          !dragging && "transition-transform duration-200 ease-emphasized",
          confirmed
            ? "bg-success-foreground text-success"
            : disabled
              ? "cursor-not-allowed bg-input text-surface shadow-none"
              : "bg-primary text-primary-foreground",
        )}
      >
        {confirmed ? (
          <Check aria-hidden="true" className="size-6" />
        ) : (
          <ChevronsRight aria-hidden="true" className="size-6" />
        )}
      </button>
    </div>
  );
}
