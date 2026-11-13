import { cva, type VariantProps } from "class-variance-authority";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

const alertVariants = cva("flex gap-3 rounded-xl border p-4", {
  variants: {
    tone: {
      info: "border-info/40 bg-info-subtle text-info-strong",
      success: "border-success/40 bg-success-subtle text-success-strong",
      warning: "border-warning/40 bg-warning-subtle text-warning-strong",
      critical: "border-critical/40 bg-critical-subtle text-critical-strong",
    },
  },
  defaultVariants: { tone: "info" },
});

const icons = { info: Info, success: CircleCheck, warning: TriangleAlert, critical: CircleAlert };

export type AlertProps = Omit<ComponentProps<"div">, "title"> &
  VariantProps<typeof alertVariants> & { title: ReactNode };

/** Inline message. Critical alerts use role="alert" (announced immediately); others role="status". */
export function Alert({ tone = "info", title, children, className, ...props }: AlertProps) {
  const Icon = icons[tone ?? "info"];
  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {children ? <div className="text-foreground">{children}</div> : null}
      </div>
    </div>
  );
}
