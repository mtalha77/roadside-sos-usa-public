import { cn } from "../lib/cn";
import { AvatarPhoto } from "./avatar-photo";

export type AvatarProps = {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = { sm: "size-8 text-xs", md: "size-12 text-base", lg: "size-16 text-lg" };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/**
 * Photo with an initials fallback; the name is the accessible text. Without a photo it renders on
 * the server with no JavaScript; with one, the photo part loads in the browser.
 */
export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  if (src)
    return (
      <AvatarPhoto
        src={src}
        name={name}
        initials={initials(name)}
        className={cn(sizes[size], className)}
      />
    );
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted font-semibold text-foreground",
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
