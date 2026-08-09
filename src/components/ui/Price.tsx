import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PriceProps {
  value: number;
  /** e.g. "-" on a discount line. */
  prefix?: string;
  className?: string;
}

/**
 * The ONLY way a price may reach the DOM.
 *
 * `formatPrice` produces "4 500 DA" — digits, a space, then a Latin suffix.
 * Under the Unicode Bidi Algorithm those are separate directional runs, and in
 * the Arabic (RTL) layout the neutral space lets the browser reorder the whole
 * thing into "DA 500 4". It reproduces every time, on every page that shows a
 * price. dir="ltr" pins the run; keeping it in one component means no call site
 * can regress.
 */
export function Price({ value, prefix, className }: PriceProps) {
  return (
    <span dir="ltr" className={cn("tabular-nums", className)}>
      {prefix}
      {formatPrice(value)}
    </span>
  );
}

/**
 * A discount badge, e.g. "-24%".
 *
 * The leading "-" is a bidi-neutral character at the start of the run, so in the
 * Arabic layout it is reordered to the far side and the badge renders "24%-".
 * Same fix as Price: pin the run with dir="ltr" in one place.
 */
export function Discount({ value, className }: { value: number; className?: string }) {
  return (
    <span dir="ltr" className={cn("tabular-nums", className)}>
      -{value}%
    </span>
  );
}

/** Same bidi protection for any bare number sitting next to a unit or label. */
export function Num({ value, className }: { value: number | string; className?: string }) {
  return (
    <span dir="ltr" className={cn("tabular-nums", className)}>
      {value}
    </span>
  );
}
