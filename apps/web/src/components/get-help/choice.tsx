import type { ReactNode } from "react";

/** A radio option drawn as a large card (48px+, keyboard and screen-reader native). */
export function Choice({
  name,
  value,
  checked,
  children,
  id,
  required = true,
}: {
  name: string;
  value: string;
  checked?: boolean;
  children: ReactNode;
  id?: string;
  required?: boolean;
}) {
  return (
    <label className="flex min-h-touch cursor-pointer items-center gap-3 rounded-xl border-2 border-border bg-surface px-4 py-3 transition-colors duration-150 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        defaultChecked={checked}
        required={required}
        className="size-5 accent-[var(--primary)]"
      />
      <span className="font-medium">{children}</span>
    </label>
  );
}
