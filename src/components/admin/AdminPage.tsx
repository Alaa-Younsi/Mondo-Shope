import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Consistent padded page shell + header for every admin screen. */
export function AdminPage({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8", className)}>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
      </header>
      {children}
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
  action,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border border-line bg-panel", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          {title && (
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/**
 * Admin tables live inside this. Without the horizontal scroll container and
 * `whitespace-nowrap` on the cells, mobile widths wrap order numbers, names and
 * dates into unreadable multi-line cells instead of scrolling.
 */
const MIN_WIDTH = {
  sm: "min-w-[34rem]",
  md: "min-w-[44rem]",
  lg: "min-w-[46rem]",
  xl: "min-w-[52rem]",
} as const;

export function TableScroll({
  children,
  minWidth = "md",
}: {
  children: ReactNode;
  minWidth?: keyof typeof MIN_WIDTH;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <div className={MIN_WIDTH[minWidth]}>{children}</div>
    </div>
  );
}
