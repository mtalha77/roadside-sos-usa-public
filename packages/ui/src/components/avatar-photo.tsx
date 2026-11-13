"use client";

import { useState } from "react";

/**
 * Photo with an initials fallback if it fails to load. Deliberately tiny (no Radix, no class
 * merging) because pages that only import `Avatar` still ship this part.
 */
export function AvatarPhoto({
  src,
  name,
  initials,
  className,
}: {
  src: string;
  name: string;
  initials: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  const box = `relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted font-semibold text-foreground ${className}`;
  if (failed)
    return (
      <span role="img" aria-label={name} className={box}>
        {initials}
      </span>
    );
  return (
    <span className={box}>
      {/* eslint-disable-next-line @next/next/no-img-element -- shared UI package, not a Next page */}
      <img
        src={src}
        alt={name}
        className="size-full object-cover"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
