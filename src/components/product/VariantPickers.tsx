import { Check } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { isOptionAvailable, trackedStock } from "@/lib/variantStock";
import { cn, pick } from "@/lib/utils";
import type { ProductColor, ProductSize, ProductVariantGroup } from "@/types/db";

/**
 * The remaining-stock caption printed under one option.
 *
 * Only TRACKED options get one — see `trackedStock`. A depleted option keeps
 * its "0" instead of being hidden: the shopper who came for that exact size
 * needs to read that it exists and is gone, which is the same reason the
 * button below is struck through rather than removed.
 */
function OptionStockNote({ stock }: { stock: number | null }) {
  const { t } = useLanguage();
  if (stock === null) return null;

  return (
    <span
      className={cn(
        "whitespace-nowrap text-[10px] font-medium leading-none",
        stock <= 0 ? "text-danger" : stock <= 5 ? "text-warning" : "text-muted",
      )}
    >
      {stock <= 0 ? (
        <>
          <span dir="ltr">0</span> · {t("soldOut")}
        </>
      ) : (
        <>
          <span dir="ltr">{stock}</span> {t("stockLeft")}
        </>
      )}
    </span>
  );
}

interface ColorPickerProps {
  colors: ProductColor[];
  selectedHex: string | null;
  onSelect: (hex: string, label: string) => void;
  /** Product-level stock, the fallback for any option with no pool of its own. */
  productStock: number;
}

export function ColorPicker({
  colors,
  selectedHex,
  onSelect,
  productStock,
}: ColorPickerProps) {
  const { t, lang } = useLanguage();
  if (colors.length === 0) return null;

  const selected = colors.find((color) => color.hex === selectedHex);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {t("chooseColor")}
        {selected && <span className="ms-2 text-ink">{pick(lang, selected, "label")}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => {
          const label = pick(lang, color, "label");
          const isActive = color.hex === selectedHex;
          const available = isOptionAvailable(color, productStock);
          return (
            <div key={color.hex} className="flex flex-col items-center gap-1">
              <button
                type="button"
                disabled={!available}
                onClick={() => onSelect(color.hex, label)}
                title={available ? label : `${label} — ${t("outOfStock")}`}
                aria-label={available ? label : `${label} — ${t("outOfStock")}`}
                aria-pressed={isActive}
                className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-lg border-2 transition-transform",
                  isActive ? "border-brand scale-105" : "border-line hover:border-muted",
                  // Struck through rather than hidden: a shopper who came for
                  // that colour needs to see it exists and is gone, not wonder
                  // whether they misremembered the ad.
                  !available && "cursor-not-allowed opacity-40",
                )}
              >
                <span
                  className="h-7 w-7 rounded-md border border-black/20"
                  style={{ backgroundColor: color.hex }}
                />
                {!available && (
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span className="h-[2px] w-9 rotate-45 bg-danger" />
                  </span>
                )}
                {isActive && available && (
                  <Check
                    size={12}
                    className="absolute -end-1 -top-1 rounded-full bg-brand p-0.5 text-brand-ink"
                  />
                )}
              </button>
              <OptionStockNote stock={trackedStock(color)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface SizePickerProps {
  sizes: ProductSize[];
  selected: string | null;
  onSelect: (size: string) => void;
  productStock: number;
}

export function SizePicker({ sizes, selected, onSelect, productStock }: SizePickerProps) {
  const { t } = useLanguage();
  if (sizes.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {t("chooseSize")}
      </p>
      <div className="flex flex-wrap gap-2">
        {sizes.map((size) => {
          const available = isOptionAvailable(size, productStock);
          return (
            <div key={size.value} className="flex flex-col items-center gap-1">
              <button
                type="button"
                disabled={!available}
                onClick={() => onSelect(size.value)}
                aria-pressed={size.value === selected}
                title={available ? undefined : t("outOfStock")}
                className={cn(
                  "h-11 min-w-11 rounded-lg border px-3 font-mono text-sm uppercase transition-colors",
                  size.value === selected && available
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-line text-muted hover:border-muted hover:text-ink",
                  !available &&
                    "cursor-not-allowed border-line/60 text-muted/50 line-through hover:border-line/60 hover:text-muted/50",
                )}
              >
                {size.value}
              </button>
              <OptionStockNote stock={trackedStock(size)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface CustomVariantPickerProps {
  groups: ProductVariantGroup[];
  selections: Record<string, string>;
  onSelect: (groupNameFr: string, value: string, imageUrl: string | null) => void;
  productStock: number;
}

export function CustomVariantPicker({
  groups,
  selections,
  onSelect,
  productStock,
}: CustomVariantPickerProps) {
  const { t, lang } = useLanguage();
  if (groups.length === 0) return null;

  return (
    <>
      {groups.map((group) => (
        <div key={group.name_fr} className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {pick(lang, group, "name")}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.values.map((entry) => {
              const available = isOptionAvailable(entry, productStock);
              const isActive = selections[group.name_fr] === entry.value;
              return (
                <div key={entry.value} className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    disabled={!available}
                    onClick={() => onSelect(group.name_fr, entry.value, entry.image_url ?? null)}
                    aria-pressed={isActive}
                    title={available ? undefined : t("outOfStock")}
                    className={cn(
                      "flex h-11 items-center gap-2 rounded-lg border px-3.5 text-sm transition-colors",
                      isActive && available
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-line text-muted hover:border-muted hover:text-ink",
                      !available &&
                        "cursor-not-allowed border-line/60 text-muted/50 line-through hover:border-line/60 hover:text-muted/50",
                    )}
                  >
                    {entry.image_url && (
                      <img
                        src={entry.image_url}
                        alt=""
                        width={24}
                        height={24}
                        loading="lazy"
                        decoding="async"
                        className="-ms-1.5 h-6 w-6 shrink-0 rounded object-cover"
                      />
                    )}
                    {entry.value}
                  </button>
                  <OptionStockNote stock={trackedStock(entry)} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

export function QuantityStepper({
  value,
  onChange,
  max,
}: {
  value: number;
  onChange: (next: number) => void;
  max: number;
}) {
  const ceiling = Math.max(1, Math.min(max, 20));
  return (
    <div className="inline-flex items-center rounded-lg border border-line">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="-"
        className="flex h-11 w-11 items-center justify-center text-muted transition-colors hover:text-ink disabled:opacity-40"
      >
        −
      </button>
      <span className="w-10 text-center font-mono text-sm" dir="ltr">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(ceiling, value + 1))}
        disabled={value >= ceiling}
        aria-label="+"
        className="flex h-11 w-11 items-center justify-center text-muted transition-colors hover:text-ink disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
