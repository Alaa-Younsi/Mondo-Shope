import type { Lang } from "@/types/db";

/**
 * fr-FR digit grouping uses U+202F (narrow no-break space) on modern ICU and
 * U+00A0 on older ones. Both are in JS's `\s` class, so this normalises either
 * to a plain space without putting an invisible character in the source.
 */
const GROUP_SEPARATORS = /\s/g;

/**
 * Algerian dinar, e.g. "12 500 DA" — space thousands separator, DA suffix.
 *
 * NEVER call this directly inside JSX. Use <Price value={n} />: the resulting
 * string mixes digits, a space and a Latin suffix, which the Unicode Bidi
 * Algorithm visually reorders to "DA 500 12" whenever the ambient direction is
 * RTL. The component wraps it in dir="ltr" so no call site can regress.
 */
export function formatPrice(value: number): string {
  const rounded = Math.round(Number(value) || 0);
  return `${rounded.toLocaleString("fr-FR").replace(GROUP_SEPARATORS, " ")} DA`;
}

export function formatNumber(value: number): string {
  return (Number(value) || 0).toLocaleString("fr-FR").replace(GROUP_SEPARATORS, " ");
}

export function formatDate(iso: string, lang: Lang = "fr"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(iso: string, lang: Lang = "fr"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Local calendar day as YYYY-MM-DD.
 *
 * Do NOT use `new Date(iso).toISOString().slice(0,10)` — it re-projects into
 * UTC, so an Algiers order placed at 00:30 lands on the previous day and
 * "today's orders" silently drops it.
 */
export function toLocalDay(value: string | Date): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
