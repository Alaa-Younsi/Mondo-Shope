import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Form";
import { ImageUploader } from "./ImageUploader";
import { useLanguage } from "@/i18n/LanguageProvider";
import { sanitizeOffers } from "@/lib/offers";
import type {
  ProductColor,
  ProductSize,
  ProductVariantGroup,
  ProductVariantValue,
  QuantityOffer,
  StockCell,
} from "@/types/db";

/* -------------------------------------------------------------------------- */
/* Chip list — sizes, variant values                                          */
/* -------------------------------------------------------------------------- */

export function ChipListEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState("");

  const commit = () => {
    const value = draft.trim();
    // Duplicates and empty drafts are silently ignored.
    if (!value || values.includes(value)) {
      setDraft("");
      return;
    }
    onChange([...values, value]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel-2 py-1 ps-3 pe-1.5 text-sm"
            >
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((entry) => entry !== value))}
                className="rounded-full p-0.5 text-muted transition-colors hover:text-danger"
                aria-label={t("delete")}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
        />
        <Button variant="secondary" onClick={commit} className="shrink-0">
          <Plus size={14} />
          {t("prodAddValue")}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Option list — sizes and custom variant values, each with its own stock      */
/* -------------------------------------------------------------------------- */

/**
 * Replaces the plain chip list for anything the client tracks stock on.
 *
 * Leaving the stock box EMPTY means "don't track this option" — it then sells
 * against the product's own stock, which is exactly how every product created
 * before per-option stock existed keeps behaving. A number makes it a pool of
 * its own that place_order() checks and decrements.
 */
export function OptionListEditor({
  values,
  onChange,
  withImages,
  placeholder,
  /** Hide the per-value stock box: a stock grid is on, so it is ignored. */
  stockFromGrid,
}: {
  values: ProductVariantValue[];
  onChange: (next: ProductVariantValue[]) => void;
  /** Custom variant values offer a photo; sizes do not. */
  withImages?: boolean;
  placeholder?: string;
  stockFromGrid?: boolean;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState("");

  const commit = () => {
    const value = draft.trim();
    // Duplicates and empty drafts are silently ignored.
    if (!value || values.some((entry) => entry.value === value)) {
      setDraft("");
      return;
    }
    onChange([...values, { value, image_url: null, stock: null }]);
    setDraft("");
  };

  const update = (index: number, patch: Partial<ProductVariantValue>) =>
    onChange(values.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  return (
    <div className="space-y-2">
      {values.map((entry, index) => (
        <div
          key={index}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-panel-2 p-2"
        >
          <div className="min-w-32 flex-1">
            <Field label={t("prodOptionValue")}>
              <Input
                value={entry.value}
                onChange={(event) => update(index, { value: event.target.value })}
              />
            </Field>
          </div>

          {!stockFromGrid && (
            <div className="w-28">
              <Field label={t("prodOptionStock")}>
                <Input
                  type="number"
                  min={0}
                  dir="ltr"
                  placeholder={t("prodStockUntracked")}
                  value={entry.stock ?? ""}
                  onChange={(event) =>
                    update(index, {
                      stock:
                        event.target.value === ""
                          ? null
                          : Math.max(0, Math.floor(Number(event.target.value) || 0)),
                    })
                  }
                />
              </Field>
            </div>
          )}

          {withImages && (
            <ImageUploader
              compact
              label={t("prodOptionImage")}
              prefix="variants/"
              value={entry.image_url ?? null}
              onChange={(url) => update(index, { image_url: url })}
            />
          )}

          <button
            type="button"
            onClick={() => onChange(values.filter((_, i) => i !== index))}
            aria-label={t("delete")}
            className="mb-1 h-11 rounded-lg border border-line px-3 text-muted transition-colors hover:border-danger hover:text-danger"
          >
            <X size={15} />
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
        />
        <Button variant="secondary" onClick={commit} className="shrink-0">
          <Plus size={14} />
          {t("prodAddValue")}
        </Button>
      </div>

      <p className="text-xs text-muted">
        {stockFromGrid ? t("prodStockFromGrid") : t("prodOptionStockHint")}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Colours (with optional per-swatch photo)                                    */
/* -------------------------------------------------------------------------- */

export function ColorsEditor({
  colors,
  onChange,
  /** Hide the per-colour stock box: a stock grid is on, so it is ignored. */
  stockFromGrid,
}: {
  colors: ProductColor[];
  onChange: (next: ProductColor[]) => void;
  stockFromGrid?: boolean;
}) {
  const { t } = useLanguage();

  const update = (index: number, patch: Partial<ProductColor>) =>
    onChange(colors.map((color, i) => (i === index ? { ...color, ...patch } : color)));

  return (
    <div className="space-y-3">
      {colors.map((color, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-lg border border-line bg-panel-2 p-3 sm:grid-cols-[auto_1fr_1fr_auto_auto_auto] sm:items-end"
        >
          <Field label={t("prodColorHex")}>
            <input
              type="color"
              value={color.hex || "#000000"}
              onChange={(event) => update(index, { hex: event.target.value })}
              className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-panel-2 p-1"
            />
          </Field>

          <Field label={t("prodColorLabelFr")}>
            <Input
              value={color.label_fr}
              onChange={(event) => update(index, { label_fr: event.target.value })}
            />
          </Field>

          <Field label={t("prodColorLabelAr")}>
            <Input
              dir="rtl"
              value={color.label_ar}
              onChange={(event) => update(index, { label_ar: event.target.value })}
            />
          </Field>

          {/* Empty = untracked: this colour sells against the product's own
              stock. A number gives it a pool place_order() checks separately.
              Withheld entirely under a stock grid — the grid is the authority
              there, and an editable box that changes nothing is worse than no
              box at all. */}
          {!stockFromGrid && (
            <div className="w-28">
              <Field label={t("prodOptionStock")}>
                <Input
                  type="number"
                  min={0}
                  dir="ltr"
                  placeholder={t("prodStockUntracked")}
                  value={color.stock ?? ""}
                  onChange={(event) =>
                    update(index, {
                      stock:
                        event.target.value === ""
                          ? null
                          : Math.max(0, Math.floor(Number(event.target.value) || 0)),
                    })
                  }
                />
              </Field>
            </div>
          )}

          {/* An optional photo: picking this swatch jumps the product gallery
              to it. Colours without one simply leave the gallery alone. */}
          <ImageUploader
            compact
            label={t("prodColorImage")}
            prefix="colors/"
            value={color.image_url ?? null}
            onChange={(url) => update(index, { image_url: url })}
          />

          <button
            type="button"
            onClick={() => onChange(colors.filter((_, i) => i !== index))}
            aria-label={t("delete")}
            className="mb-1 h-11 rounded-lg border border-line px-3 text-muted transition-colors hover:border-danger hover:text-danger"
          >
            <X size={15} />
          </button>
        </div>
      ))}

      <Button
        variant="secondary"
        onClick={() =>
          onChange([
            ...colors,
            { hex: "#000000", label_fr: "", label_ar: "", image_url: null, stock: null },
          ])
        }
      >
        <Plus size={14} />
        {t("add")}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Custom variant groups                                                       */
/* -------------------------------------------------------------------------- */

export function CustomVariantsEditor({
  groups,
  onChange,
}: {
  groups: ProductVariantGroup[];
  onChange: (next: ProductVariantGroup[]) => void;
}) {
  const { t } = useLanguage();

  const update = (index: number, patch: Partial<ProductVariantGroup>) =>
    onChange(groups.map((group, i) => (i === index ? { ...group, ...patch } : group)));

  return (
    <div className="space-y-3">
      {groups.map((group, index) => (
        <div key={index} className="space-y-3 rounded-lg border border-line bg-panel-2 p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label={t("prodVariantNameFr")}>
              <Input
                value={group.name_fr}
                onChange={(event) => update(index, { name_fr: event.target.value })}
              />
            </Field>
            <Field label={t("prodVariantNameAr")}>
              <Input
                dir="rtl"
                value={group.name_ar}
                onChange={(event) => update(index, { name_ar: event.target.value })}
              />
            </Field>
            <button
              type="button"
              onClick={() => onChange(groups.filter((_, i) => i !== index))}
              aria-label={t("delete")}
              className="mb-1 h-11 rounded-lg border border-line px-3 text-muted transition-colors hover:border-danger hover:text-danger"
            >
              <X size={15} />
            </button>
          </div>

          <Field label={t("prodVariantValues")}>
            <OptionListEditor
              withImages
              values={group.values}
              onChange={(values) => update(index, { values })}
            />
          </Field>
        </div>
      ))}

      <Button
        variant="secondary"
        onClick={() => onChange([...groups, { name_fr: "", name_ar: "", values: [] }])}
      >
        <Plus size={14} />
        {t("add")}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Quantity offers                                                             */
/* -------------------------------------------------------------------------- */

export function OffersEditor({
  offers,
  onChange,
}: {
  offers: QuantityOffer[];
  onChange: (next: QuantityOffer[]) => void;
}) {
  const { t } = useLanguage();

  const update = (index: number, next: QuantityOffer) =>
    onChange(offers.map((offer, i) => (i === index ? next : offer)));

  return (
    <div className="space-y-3">
      {offers.map((offer, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-lg border border-line bg-panel-2 p-3 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-end"
        >
          <Field label={t("prodOffers")}>
            <Select
              value={offer.type}
              onChange={(event) =>
                update(
                  index,
                  event.target.value === "free"
                    ? { type: "free", buy: 1, get: 1 }
                    : { type: "price", qty: 2, price: 0 },
                )
              }
            >
              <option value="free">{t("prodOfferFree")}</option>
              <option value="price">{t("prodOfferPrice")}</option>
            </Select>
          </Field>

          {offer.type === "free" ? (
            <>
              <Field label={t("prodOfferBuy")}>
                <Input
                  type="number"
                  min={1}
                  value={offer.buy}
                  onChange={(event) =>
                    update(index, { ...offer, buy: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label={t("prodOfferGet")}>
                <Input
                  type="number"
                  min={1}
                  value={offer.get}
                  onChange={(event) =>
                    update(index, { ...offer, get: Number(event.target.value) })
                  }
                />
              </Field>
            </>
          ) : (
            <>
              <Field label={t("prodOfferQty")}>
                <Input
                  type="number"
                  min={1}
                  value={offer.qty}
                  onChange={(event) =>
                    update(index, { ...offer, qty: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label={t("prodOfferPriceValue")}>
                <Input
                  type="number"
                  min={0}
                  value={offer.price}
                  onChange={(event) =>
                    update(index, { ...offer, price: Number(event.target.value) })
                  }
                />
              </Field>
            </>
          )}

          <button
            type="button"
            onClick={() => onChange(offers.filter((_, i) => i !== index))}
            aria-label={t("delete")}
            className="mb-1 h-11 rounded-lg border border-line px-3 text-muted transition-colors hover:border-danger hover:text-danger"
          >
            <X size={15} />
          </button>
        </div>
      ))}

      <Button
        variant="secondary"
        onClick={() => onChange(sanitizeOffers([...offers, { type: "free", buy: 1, get: 1 }]))}
      >
        <Plus size={14} />
        {t("add")}
      </Button>

      <p className="text-xs leading-relaxed text-muted">{t("prodOffersHint")}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Colour x size stock grid                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The grid that connects colour and size (migration 0013).
 *
 * Rows are the product's colours, columns its sizes, and each cell holds the
 * stock for that exact pairing. Unticking a cell means the combination is NOT
 * OFFERED, which is a different thing from a cell holding zero: zero shows the
 * shopper a struck-through option that may come back, absent removes it from
 * that colour entirely.
 *
 * The grid is keyed on the colour's HEX rather than its label, because labels
 * are bilingual and editable — renaming "Rouge" to "Rouge vif" must not orphan
 * a row. `place_order()` resolves the shopper's label back to the hex.
 *
 * Turning the grid off (the toggle) clears every cell. That is deliberate and
 * irreversible in one step: a half-kept grid would leave the product's stock
 * split between two models with no way to say which one is true.
 */
export function StockMatrixEditor({
  colors,
  sizes,
  matrix,
  onChange,
}: {
  colors: ProductColor[];
  sizes: ProductSize[];
  matrix: StockCell[];
  onChange: (next: StockCell[]) => void;
}) {
  const { t } = useLanguage();

  // Both axes are needed to have anything to cross. The SQL agrees — see
  // matrix_active() — so an unbuildable grid is not offered rather than shown
  // empty and mysterious.
  if (colors.length === 0 || sizes.length === 0) {
    return <p className="text-xs text-muted">{t("prodGridNeedsAxes")}</p>;
  }

  const enabled = matrix.length > 0;
  const cellAt = (color: string, size: string) =>
    matrix.find((cell) => cell.color === color && cell.size === size);

  const total = matrix.reduce((sum, cell) => sum + Math.max(0, cell.stock), 0);

  /*
   * Row and column totals are DERIVED, never stored.
   *
   * A colour's stock is the sum of its sizes — there is no separate "Red = 70"
   * to type, and so no way for the sizes to exceed it. Storing both would mean
   * two numbers for one fact, and every sale, cancellation and manual edit
   * would have to keep them agreeing. These read-outs exist so the admin can
   * SEE the colour total while distributing it, not so they can set it.
   */
  const colorTotal = (hex: string) =>
    matrix
      .filter((cell) => cell.color === hex)
      .reduce((sum, cell) => sum + Math.max(0, cell.stock), 0);

  const sizeTotal = (value: string) =>
    matrix
      .filter((cell) => cell.size === value)
      .reduce((sum, cell) => sum + Math.max(0, cell.stock), 0);

  const setCell = (color: string, size: string, stock: number) => {
    const rest = matrix.filter((cell) => !(cell.color === color && cell.size === size));
    onChange([...rest, { color, size, stock: Math.max(0, Math.floor(stock) || 0) }]);
  };

  const clearCell = (color: string, size: string) =>
    onChange(matrix.filter((cell) => !(cell.color === color && cell.size === size)));

  const enable = () =>
    onChange(
      colors.flatMap((color) =>
        sizes.map((size) => ({ color: color.hex, size: size.value, stock: 0 })),
      ),
    );

  if (!enabled) {
    return (
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-muted">{t("prodGridOffHint")}</p>
        <Button variant="secondary" onClick={enable}>
          <Plus size={14} />
          {t("prodGridEnable")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted">{t("prodGridOnHint")}</p>

      {/* Sizes can outgrow a phone-width panel, so the table scrolls inside
          its own box rather than stretching the admin layout. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-max border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="px-2 text-start text-xs font-medium uppercase tracking-wide text-muted">
                {t("prodGridColorSize")}
              </th>
              {sizes.map((size) => (
                <th
                  key={size.value}
                  className="px-2 text-center font-mono text-xs uppercase text-muted"
                >
                  {size.value}
                </th>
              ))}
              <th className="px-2 text-end text-xs font-medium uppercase tracking-wide text-muted">
                {t("prodGridRowTotal")}
              </th>
            </tr>
          </thead>
          <tbody>
            {colors.map((color) => (
              <tr key={color.hex}>
                <td className="whitespace-nowrap px-2">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-5 w-5 shrink-0 rounded border border-black/20"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="text-ink">{color.label_fr || color.hex}</span>
                  </span>
                </td>
                {sizes.map((size) => {
                  const cell = cellAt(color.hex, size.value);
                  const offered = cell !== undefined;
                  return (
                    <td key={size.value} className="px-1">
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={offered}
                          aria-label={`${color.label_fr || color.hex} / ${size.value}`}
                          onChange={(event) =>
                            event.target.checked
                              ? setCell(color.hex, size.value, 0)
                              : clearCell(color.hex, size.value)
                          }
                          className="h-4 w-4 shrink-0 accent-brand"
                        />
                        {/* Width lives on the wrapper, not the input: `cn` is
                            a plain join, so a `w-20` here would just collide
                            with CONTROL's `w-full` and lose. */}
                        <div className="w-20">
                          <Input
                            type="number"
                            min={0}
                            dir="ltr"
                            disabled={!offered}
                            value={offered ? cell.stock : ""}
                            placeholder="—"
                            onChange={(event) =>
                              setCell(color.hex, size.value, Number(event.target.value))
                            }
                            className="text-center"
                          />
                        </div>
                      </div>
                    </td>
                  );
                })}
                <td className="whitespace-nowrap px-2 text-end">
                  <span dir="ltr" className="font-mono text-sm text-ink">
                    {colorTotal(color.hex)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted">
                {t("prodGridColTotal")}
              </td>
              {sizes.map((size) => (
                <td key={size.value} className="px-2 pt-1 text-center">
                  <span dir="ltr" className="font-mono text-sm text-muted">
                    {sizeTotal(size.value)}
                  </span>
                </td>
              ))}
              <td className="px-2 pt-1 text-end">
                <span dir="ltr" className="font-mono text-sm font-semibold text-ink">
                  {total}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <p className="text-xs text-muted">
          {t("prodGridTotal")} <span dir="ltr" className="font-mono text-ink">{total}</span>
        </p>
        <button
          type="button"
          onClick={() => onChange([])}
          className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-danger hover:text-danger"
        >
          {t("prodGridDisable")}
        </button>
      </div>
    </div>
  );
}
