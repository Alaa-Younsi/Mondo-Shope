import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "brand" | "neutral" | "success" | "danger" | "warning" | "info";

const TONES: Record<Tone, string> = {
  brand: "border-brand/50 bg-brand/10 text-brand",
  neutral: "border-line bg-panel-2 text-muted",
  success: "border-success/50 bg-success/10 text-success",
  danger: "border-danger/50 bg-danger/10 text-danger",
  warning: "border-warning/50 bg-warning/10 text-warning",
  info: "border-line bg-panel-2 text-ink",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "start",
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "start" | "center";
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-12 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "sm:flex-col sm:items-center sm:text-center",
      )}
    >
      <div className={cn("min-w-0", align === "center" && "text-center")}>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="neon-text font-display text-3xl font-black uppercase tracking-widest text-ink md:text-4xl">
          {title}
        </h2>
        {subtitle && <p className="mt-2 max-w-xl text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
