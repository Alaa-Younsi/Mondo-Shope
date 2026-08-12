import { Check } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { cn, pick } from "@/lib/utils";
import type { ProductColor, ProductSize, ProductVariantGroup } from "@/types/db";

/**
 * Variant pickers.
 *
 * NO STOCK COUNT IS EVER RENDERED HERE. How many are left is the shop's
 * business, not the shopper's: a "2 left" caption invites both haggling and a
 * competitor reading the shop's inventory off the public site. An option is
 * either selectable or visibly disabled with an "out of stock" label, and
 * that is the whole vocabulary.
 *
 * A depleted option is greyed and struck through rather than removed — the
 * shopper who came for that exact size needs to read that it exists and is
 * gone, not wonder whether they misremembered the ad.
 *
 * Availability is decided by the caller via `isAvailable`, because under a
 * stock grid it depends on the OTHER axis: a size is available or not
 * depending on the colour currently selected. See lib/variantStock.
 */

/** Shared "out of stock" caption under a disabled option. */
function SoldOutNote({ show }: { show: boolean }) {
  const { t } = useLanguage();
  if (!show) return null;

  return (
    <span className="whitespace-nowrap text-[10px] font-medium leading-none text-danger">
      {t("soldOut")}
    </span>
  );
}

interface ColorPickerProps {
  colors: ProductColor[];
  selectedHex: string | null;
  onSelect: (hex: string, label: string) => void;
  isAvailable: (hex: string) => boolean;
}

export function ColorPicker({
  colors,
  selectedHex,
  onSelect,
  isAvailable,
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
          const available = isAvailable(color.hex);
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
              <SoldOutNote show={!available} />
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
  isAvailable: (value: string) => boolean;
}

export function SizePicker({ sizes, selected, onSelect, isAvailable }: SizePickerProps) {
  const { t } = useLanguage();
  if (sizes.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {t("chooseSize")}
      </p>
      <div className="flex flex-wrap gap-2">
        {sizes.map((size) => {
          const available = isAvailable(size.value);
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
              <SoldOutNote show={!available} />
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
  isAvailable: (groupNameFr: string, value: string) => boolean;
}

export function CustomVariantPicker({
  groups,
  selections,
  onSelect,
  isAvailable,
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
              const available = isAvailable(group.name_fr, entry.value);
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
                  <SoldOutNote show={!available} />
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
