import { Check } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { cn, pick } from "@/lib/utils";
import type { ProductColor, ProductVariantGroup } from "@/types/db";

interface ColorPickerProps {
  colors: ProductColor[];
  selectedHex: string | null;
  onSelect: (hex: string, label: string) => void;
}

export function ColorPicker({ colors, selectedHex, onSelect }: ColorPickerProps) {
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
          return (
            <button
              key={color.hex}
              type="button"
              onClick={() => onSelect(color.hex, label)}
              title={label}
              aria-label={label}
              aria-pressed={isActive}
              className={cn(
                "relative flex h-11 w-11 items-center justify-center rounded-lg border-2 transition-transform",
                isActive ? "border-brand scale-105" : "border-line hover:border-muted",
              )}
            >
              <span
                className="h-7 w-7 rounded-md border border-black/20"
                style={{ backgroundColor: color.hex }}
              />
              {isActive && (
                <Check
                  size={12}
                  className="absolute -end-1 -top-1 rounded-full bg-brand p-0.5 text-brand-ink"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SizePickerProps {
  sizes: string[];
  selected: string | null;
  onSelect: (size: string) => void;
}

export function SizePicker({ sizes, selected, onSelect }: SizePickerProps) {
  const { t } = useLanguage();
  if (sizes.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {t("chooseSize")}
      </p>
      <div className="flex flex-wrap gap-2">
        {sizes.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => onSelect(size)}
            aria-pressed={size === selected}
            className={cn(
              "h-11 min-w-11 rounded-lg border px-3 font-mono text-sm uppercase transition-colors",
              size === selected
                ? "border-brand bg-brand/10 text-brand"
                : "border-line text-muted hover:border-muted hover:text-ink",
            )}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}

interface CustomVariantPickerProps {
  groups: ProductVariantGroup[];
  selections: Record<string, string>;
  onSelect: (groupNameFr: string, value: string) => void;
}

export function CustomVariantPicker({
  groups,
  selections,
  onSelect,
}: CustomVariantPickerProps) {
  const { lang } = useLanguage();
  if (groups.length === 0) return null;

  return (
    <>
      {groups.map((group) => (
        <div key={group.name_fr} className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {pick(lang, group, "name")}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.values.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onSelect(group.name_fr, value)}
                aria-pressed={selections[group.name_fr] === value}
                className={cn(
                  "h-11 rounded-lg border px-3.5 text-sm transition-colors",
                  selections[group.name_fr] === value
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-line text-muted hover:border-muted hover:text-ink",
                )}
              >
                {value}
              </button>
            ))}
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
