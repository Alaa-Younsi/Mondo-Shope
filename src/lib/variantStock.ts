import type { Product, ProductVariantGroup } from "@/types/db";

/**
 * Per-option stock, client side.
 *
 * The authority is place_order() — it re-checks and decrements every pool with
 * the product row locked, so nothing here is a guarantee. This exists so the
 * shopper sees a sold-out size greyed out instead of discovering it after
 * typing their phone number, and so the quantity stepper cannot be pushed past
 * what the chosen option actually has.
 *
 * `stock: null` on an option means untracked: that option is limited only by
 * the product's own stock, which is how every product written before the
 * per-option migration behaves.
 */

export interface VariantChoice {
  colorHex: string | null;
  size: string | null;
  variantPicks: Record<string, string>;
}

/** What one option has left: its own pool when tracked, else the product's. */
export function optionStock(
  option: { stock?: number | null } | undefined,
  productStock: number,
): number {
  if (!option) return productStock;
  return option.stock == null ? productStock : option.stock;
}

export function isOptionAvailable(
  option: { stock?: number | null } | undefined,
  productStock: number,
): boolean {
  return optionStock(option, productStock) > 0;
}

/**
 * The real ceiling for the quantity stepper: the smallest pool among the
 * product and every option the shopper has actually selected.
 */
export function availableStock(product: Product, choice: VariantChoice): number {
  let limit = product.stock;

  const color = product.colors.find((entry) => entry.hex === choice.colorHex);
  if (color) limit = Math.min(limit, optionStock(color, product.stock));

  const size = product.sizes.find((entry) => entry.value === choice.size);
  if (size) limit = Math.min(limit, optionStock(size, product.stock));

  for (const group of product.variants) {
    const picked = choice.variantPicks[group.name_fr];
    if (!picked) continue;
    const value = group.values.find((entry) => entry.value === picked);
    if (value) limit = Math.min(limit, optionStock(value, product.stock));
  }

  return Math.max(0, limit);
}

/**
 * Axes the shopper still has to choose from.
 *
 * An axis only counts as unanswered when at least one of its options is still
 * in stock — a product whose every size is sold out must not block the form on
 * a choice that cannot be made. place_order() applies the same rule, so the
 * button and the server agree.
 */
export function missingChoices(
  product: Product,
  choice: VariantChoice,
): Array<{ key: string; group: ProductVariantGroup | null; kind: "color" | "size" | "custom" }> {
  const missing: Array<{
    key: string;
    group: ProductVariantGroup | null;
    kind: "color" | "size" | "custom";
  }> = [];

  const anyColor = product.colors.some((entry) => isOptionAvailable(entry, product.stock));
  if (anyColor && !product.colors.some((entry) => entry.hex === choice.colorHex)) {
    missing.push({ key: "color", group: null, kind: "color" });
  }

  const anySize = product.sizes.some((entry) => isOptionAvailable(entry, product.stock));
  if (anySize && !product.sizes.some((entry) => entry.value === choice.size)) {
    missing.push({ key: "size", group: null, kind: "size" });
  }

  for (const group of product.variants) {
    const anyValue = group.values.some((entry) => isOptionAvailable(entry, product.stock));
    if (!anyValue) continue;
    const picked = choice.variantPicks[group.name_fr];
    if (!picked || !group.values.some((entry) => entry.value === picked)) {
      missing.push({ key: group.name_fr, group, kind: "custom" });
    }
  }

  return missing;
}

/**
 * True when nothing on the product can be bought — either the product pool is
 * empty, or some axis has every one of its options at zero.
 */
export function isSoldOut(product: Product): boolean {
  if (product.stock <= 0) return true;
  if (product.colors.length > 0 && !product.colors.some((c) => isOptionAvailable(c, product.stock)))
    return true;
  if (product.sizes.length > 0 && !product.sizes.some((s) => isOptionAvailable(s, product.stock)))
    return true;
  return product.variants.some(
    (group) =>
      group.values.length > 0 &&
      !group.values.some((value) => isOptionAvailable(value, product.stock)),
  );
}
