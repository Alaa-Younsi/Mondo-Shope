import type { Product, ProductVariantGroup, StockCell } from "@/types/db";

/**
 * Variant availability, client side.
 *
 * The authority is place_order() — it re-checks and decrements every pool with
 * the product row locked, so nothing here is a guarantee. This exists so the
 * shopper sees a sold-out size greyed out instead of discovering it after
 * typing their phone number, and so the quantity stepper cannot be pushed past
 * what the chosen combination actually has.
 *
 * TWO MODELS live side by side, exactly as the SQL does:
 *
 *   GRID (0013) — the product carries a `stock_matrix`, one cell per offered
 *   colour+size pairing. The grid is then the only authority for those two
 *   axes and their own `stock` fields are ignored.
 *
 *   INDEPENDENT POOLS (0011) — no grid. Each option carries its own `stock`,
 *   or `null` for untracked, meaning it is limited only by the product total.
 *   Every product written before 0013 is in this mode and stays in it.
 *
 * Custom variant groups are ALWAYS independent pools, in both modes.
 *
 * NOTHING HERE RETURNS A COUNT FOR DISPLAY. The storefront never prints how
 * many are left — an option is either selectable or visibly disabled. The
 * numbers below only drive the quantity ceiling.
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

/* -------------------------------------------------------------------------- */
/* Grid                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Is the grid the authority for this product?
 *
 * Mirrors matrix_active() in SQL, and for the same reason: a grid keyed on
 * colour and size means nothing once either axis has been emptied, and a
 * product left in that state must fall back rather than become unbuyable
 * behind cells nothing can match.
 */
export function hasStockGrid(product: Product): boolean {
  return (
    product.stock_matrix.length > 0 &&
    product.colors.length > 0 &&
    product.sizes.length > 0
  );
}

/** A cell's stock, or `null` when that combination is not offered at all. */
export function cellStock(
  matrix: StockCell[],
  colorHex: string | null,
  size: string | null,
): number | null {
  if (!colorHex || !size) return null;
  const cell = matrix.find((entry) => entry.color === colorHex && entry.size === size);
  return cell ? Math.max(0, cell.stock) : null;
}

/* -------------------------------------------------------------------------- */
/* What the pickers ask                                                        */
/* -------------------------------------------------------------------------- */

export interface OptionAvailability {
  color: (hex: string) => boolean;
  size: (value: string) => boolean;
  custom: (groupNameFr: string, value: string) => boolean;
}

/**
 * One predicate per axis, built once per render from the product and whatever
 * the shopper has picked so far.
 *
 * ASYMMETRY IS DELIBERATE. Under a grid, a SIZE is judged against the selected
 * colour (pick Red, and an L that Red never had greys out) but a COLOUR is
 * judged against every size it offers, ignoring the selected size. Filtering
 * both ways looks tidier and is a trap: pick a size only one colour stocks and
 * every other colour greys out, so the shopper cannot move sideways to a colour
 * they might have preferred — they can only start over. Colour is the wider
 * choice and stays open; size narrows under it.
 */
export function optionAvailability(
  product: Product,
  choice: VariantChoice,
): OptionAvailability {
  const grid = hasStockGrid(product);

  return {
    color: (hex) => {
      if (!grid) {
        const color = product.colors.find((entry) => entry.hex === hex);
        return isOptionAvailable(color, product.stock);
      }
      return product.stock_matrix.some((cell) => cell.color === hex && cell.stock > 0);
    },

    size: (value) => {
      if (!grid) {
        const size = product.sizes.find((entry) => entry.value === value);
        return isOptionAvailable(size, product.stock);
      }
      if (choice.colorHex) {
        return (cellStock(product.stock_matrix, choice.colorHex, value) ?? 0) > 0;
      }
      return product.stock_matrix.some((cell) => cell.size === value && cell.stock > 0);
    },

    custom: (groupNameFr, value) => {
      const group = product.variants.find((entry) => entry.name_fr === groupNameFr);
      const entry = group?.values.find((option) => option.value === value);
      return isOptionAvailable(entry, product.stock);
    },
  };
}

/**
 * The real ceiling for the quantity stepper: the smallest pool among everything
 * the shopper has actually selected.
 */
export function availableStock(product: Product, choice: VariantChoice): number {
  let limit = product.stock;

  if (hasStockGrid(product)) {
    /*
     * Under a grid there is no meaningful ceiling until BOTH axes are answered,
     * so an incomplete selection is zero rather than the product total.
     *
     * That is what keeps the add button honest in one nasty corner: if the
     * selected colour has no size left, `missingChoices` sees an all-zero size
     * axis, decides the axis cannot be answered and stops requiring it — the
     * same rule that lets a fully sold-out product render without demanding an
     * impossible choice. Falling back to the product total here would then arm
     * the button on a colour with no size at all, and place_order would reject
     * it after the customer had typed their phone number.
     */
    limit = choice.colorHex && choice.size
      ? cellStock(product.stock_matrix, choice.colorHex, choice.size) ?? 0
      : 0;
  } else {
    const color = product.colors.find((entry) => entry.hex === choice.colorHex);
    if (color) limit = Math.min(limit, optionStock(color, product.stock));

    const size = product.sizes.find((entry) => entry.value === choice.size);
    if (size) limit = Math.min(limit, optionStock(size, product.stock));
  }

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
  const can = optionAvailability(product, choice);

  const anyColor = product.colors.some((entry) => can.color(entry.hex));
  if (anyColor && !product.colors.some((entry) => entry.hex === choice.colorHex)) {
    missing.push({ key: "color", group: null, kind: "color" });
  }

  const anySize = product.sizes.some((entry) => can.size(entry.value));
  if (anySize && !product.sizes.some((entry) => entry.value === choice.size)) {
    missing.push({ key: "size", group: null, kind: "size" });
  }

  for (const group of product.variants) {
    const anyValue = group.values.some((entry) => can.custom(group.name_fr, entry.value));
    if (!anyValue) continue;
    const picked = choice.variantPicks[group.name_fr];
    if (!picked || !group.values.some((entry) => entry.value === picked)) {
      missing.push({ key: group.name_fr, group, kind: "custom" });
    }
  }

  return missing;
}

/**
 * The size selection to keep after switching to `colorHex`.
 *
 * Under a grid, changing colour can invalidate the size already chosen — Red
 * had an L, Blue does not. Leaving it selected would arm the add button with a
 * pairing the server rejects, so the stale size is dropped and the shopper is
 * asked for it again.
 */
export function sizeAfterColorChange(
  product: Product,
  colorHex: string,
  size: string | null,
): string | null {
  if (!size || !hasStockGrid(product)) return size;
  return (cellStock(product.stock_matrix, colorHex, size) ?? 0) > 0 ? size : null;
}

/**
 * True when nothing on the product can be bought — either the product pool is
 * empty, or some axis has every one of its options at zero.
 */
export function isSoldOut(product: Product): boolean {
  if (product.stock <= 0) return true;

  const empty = { colorHex: null, size: null, variantPicks: {} };
  const can = optionAvailability(product, empty);

  // Under a grid `stock` is the sum of the cells, so a zero total is already
  // the whole answer for colour and size — but an empty grid row still has to
  // be caught on products where the fallback pools are in play.
  if (product.colors.length > 0 && !product.colors.some((c) => can.color(c.hex))) return true;
  if (product.sizes.length > 0 && !product.sizes.some((s) => can.size(s.value))) return true;

  return product.variants.some(
    (group) =>
      group.values.length > 0 &&
      !group.values.some((value) => can.custom(group.name_fr, value.value)),
  );
}
