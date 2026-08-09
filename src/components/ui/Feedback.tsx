import type { ReactNode } from "react";
import { Loader2, PackageOpen, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin", className)} size={18} aria-hidden />;
}

export function LoadingBlock({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted">
      <Spinner />
      {label}
    </div>
  );
}

interface StateProps {
  title: string;
  text?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, text, icon, action, className }: StateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-panel/50 px-6 py-14 text-center",
        className,
      )}
    >
      <span className="text-muted">{icon ?? <PackageOpen size={28} />}</span>
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title, text, action, className }: StateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-danger/40 bg-danger/5 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="text-danger">
        <TriangleAlert size={26} />
      </span>
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

/** Mirrors ProductCard's frame so the grid does not reflow when data lands. */
export function ProductCardSkeleton() {
  return (
    <div className="border border-line bg-panel">
      <Skeleton className="aspect-square w-full" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  );
}
