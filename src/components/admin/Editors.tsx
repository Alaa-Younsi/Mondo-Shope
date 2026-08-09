import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Form";
import { ImageUploader } from "./ImageUploader";
import { useLanguage } from "@/i18n/LanguageProvider";
import { sanitizeOffers } from "@/lib/offers";
import type { ProductColor, ProductVariantGroup, QuantityOffer } from "@/types/db";

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
/* Colours (with optional per-swatch photo)                                    */
/* -------------------------------------------------------------------------- */

export function ColorsEditor({
  colors,
  onChange,
}: {
  colors: ProductColor[];
  onChange: (next: ProductColor[]) => void;
}) {
  const { t } = useLanguage();

  const update = (index: number, patch: Partial<ProductColor>) =>
    onChange(colors.map((color, i) => (i === index ? { ...color, ...patch } : color)));

  return (
    <div className="space-y-3">
      {colors.map((color, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-lg border border-line bg-panel-2 p-3 sm:grid-cols-[auto_1fr_1fr_auto_auto] sm:items-end"
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
            { hex: "#000000", label_fr: "", label_ar: "", image_url: null },
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
            <ChipListEditor
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
