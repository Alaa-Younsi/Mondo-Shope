import type { Lang } from "@/types/db";

/**
 * Plain class-name join. NOT tailwind-merge: passing `w-20` into a component
 * whose base classes include `w-full` will NOT override it (last-in-markup does
 * not win in CSS). Size the container or the table column instead.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * An object carrying a `<field>_fr` / `<field>_ar` pair. Requiring `_fr` means
 * a typo in the field name is a compile error, not a silently empty string.
 */
export type Localized<K extends string> = { [P in `${K}_fr`]: string | null } & {
  [P in `${K}_ar`]?: string | null;
};

/** Pick the FR/AR variant of a `<field>_fr` / `<field>_ar` pair, FR as fallback. */
export function pick<K extends string>(
  lang: Lang,
  source: Localized<K>,
  field: K,
): string {
  const record = source as Record<string, unknown>;
  const localized = record[`${field}_${lang}`];
  if (typeof localized === "string" && localized.trim()) return localized;
  const fallback = record[`${field}_fr`];
  return typeof fallback === "string" ? fallback : "";
}

const SLUG_MAP: Record<string, string> = {
  à: "a", â: "a", ä: "a", á: "a", ã: "a", å: "a",
  è: "e", é: "e", ê: "e", ë: "e",
  î: "i", ï: "i", í: "i",
  ô: "o", ö: "o", ó: "o", õ: "o",
  ù: "u", û: "u", ü: "u", ú: "u",
  ç: "c", ñ: "n", ÿ: "y",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[àâäáãåèéêëîïíôöóõùûüúçñÿ]/g, (ch) => SLUG_MAP[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * PostgREST `.or()` takes a filter STRING, so raw user input in it lets a term
 * containing `,` `(` `)` inject extra filter clauses (filter-grammar injection
 * — not classic SQL injection, but the attacker still controls filter
 * semantics), and unescaped `%`/`_` enable unanchored, expensive scans.
 */
export function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[,()]/g, "")
    .replace(/[\\%_]/g, "\\$&")
    .slice(0, 100);
}

/** Stable, order-independent identity for a cart line's custom variant picks. */
export function variantKey(
  picks: Array<{ name_fr: string; value: string }> | undefined,
): string {
  if (!picks || picks.length === 0) return "";
  return picks
    .map((pick_) => `${pick_.name_fr}:${pick_.value}`)
    .sort()
    .join("|");
}

/**
 * React 18 does not type `fetchPriority`, but passes unknown lowercase
 * attributes through to the DOM untouched. Spread this onto the LCP image.
 */
export const highPriorityImageProps = {
  fetchpriority: "high",
} as unknown as { fetchPriority?: "high" };

export function isUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** A stable id for client-side collections (block lists, editor rows). */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Discount percentage from a compare-at price, or null when there is no sale. */
export function discountPercent(
  price: number,
  compareAt: number | null | undefined,
): number | null {
  const base = Number(compareAt);
  const now = Number(price);
  if (!Number.isFinite(base) || !Number.isFinite(now) || base <= now || base <= 0) {
    return null;
  }
  return Math.round(((base - now) / base) * 100);
}
