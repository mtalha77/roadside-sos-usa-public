import type { ReactNode } from "react";
import { Button, type ButtonProps } from "./button";

export type IconButtonProps = Omit<ButtonProps, "size" | "children" | "icon"> & {
  /** Required accessible name (screen readers and tooltip). */
  label: string;
  icon: ReactNode;
};

/** 48x48 icon-only button. The label is required, so it is never unnamed. */
export function IconButton({ label, icon, variant = "ghost", ...props }: IconButtonProps) {
  return (
    <Button variant={variant} size="icon" aria-label={label} title={label} {...props}>
      <span aria-hidden="true" className="contents">
        {icon}
      </span>
    </Button>
  );
}
