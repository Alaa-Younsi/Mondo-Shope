import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { ImageUploader, MultiImageUploader } from "@/components/admin/ImageUploader";
import { useLanguage } from "@/i18n/LanguageProvider";
import { BLOCK_ICON_CHOICES } from "@/lib/landing";
import type { CtaTarget, LandingBlock } from "@/types/landing";
import type { TranslationKey } from "@/i18n/translations";

/* -------------------------------------------------------------------------- */
/* Small shared pieces                                                        */
/* -------------------------------------------------------------------------- */

/** A FR/AR text pair — every piece of copy on a landing page is bilingual. */
function Pair({
  labelFr,
  labelAr,
  valueFr,
  valueAr,
  onFr,
  onAr,
  multiline,
}: {
  labelFr: TranslationKey;
  labelAr: TranslationKey;
  valueFr: string;
  valueAr: string;
  onFr: (value: string) => void;
  onAr: (value: string) => void;
  multiline?: boolean;
}) {
  const { t } = useLanguage();
  const Control = multiline ? Textarea : Input;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t(labelFr)}>
        <Control value={valueFr} onChange={(event) => onFr(event.target.value)} />
      </Field>
      <Field label={t(labelAr)}>
        <Control dir="rtl" value={valueAr} onChange={(event) => onAr(event.target.value)} />
      </Field>
    </div>
  );
}

function CtaTargetField({
  value,
  onChange,
}: {
  value: CtaTarget;
  onChange: (next: CtaTarget) => void;
}) {
  const { t } = useLanguage();
  return (
    <Field label={t("fieldCtaTarget")}>
      <Select value={value} onChange={(event) => onChange(event.target.value as CtaTarget)}>
        <option value="order_form">{t("targetOrderForm")}</option>
        <option value="offer">{t("targetOffer")}</option>
        <option value="gallery">{t("targetGallery")}</option>
        <option value="top">{t("targetTop")}</option>
      </Select>
    </Field>
  );
}

/** Repeatable item list with add / remove, shared by every list-shaped block. */
function ItemList<T>({
  items,
  onChange,
  create,
  render,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  create: () => T;
  render: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
}) {
  const { t } = useLanguage();

  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-xs text-muted">{t("noItemsYet")}</p>}

      {items.map((item, index) => (
        <div key={index} className="rounded-lg border border-line bg-panel-2 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[11px] text-muted">#{index + 1}</span>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              aria-label={t("removeItem2")}
              className="rounded p-1 text-muted transition-colors hover:text-danger"
            >
              <X size={14} />
            </button>
          </div>
          {render(
            item,
            (patch) =>
              onChange(items.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))),
            index,
          )}
        </div>
      ))}

      <Button variant="secondary" size="sm" onClick={() => onChange([...items, create()])}>
        <Plus size={14} />
        {t("addItem")}
      </Button>
    </div>
  );
}

function IconField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <Field label={t("fieldIcon")}>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        {BLOCK_ICON_CHOICES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/* -------------------------------------------------------------------------- */
/* The editor                                                                  */
/* -------------------------------------------------------------------------- */

export function BlockEditor({
  block,
  onChange,
}: {
  block: LandingBlock;
  onChange: (next: LandingBlock) => void;
}) {
  const { t } = useLanguage();

  switch (block.type) {
    case "hero": {
      const data = block.data;
      const set = (patch: Partial<typeof data>) =>
        onChange({ ...block, data: { ...data, ...patch } });
      return (
        <div className="space-y-4">
          <Pair
            labelFr="fieldEyebrowFr"
            labelAr="fieldEyebrowAr"
            valueFr={data.eyebrow_fr}
            valueAr={data.eyebrow_ar}
            onFr={(eyebrow_fr) => set({ eyebrow_fr })}
            onAr={(eyebrow_ar) => set({ eyebrow_ar })}
          />
          <Pair
            labelFr="fieldTitleFr"
            labelAr="fieldTitleAr"
            valueFr={data.title_fr}
            valueAr={data.title_ar}
            onFr={(title_fr) => set({ title_fr })}
            onAr={(title_ar) => set({ title_ar })}
          />
          <Pair
            multiline
            labelFr="fieldSubtitleFr"
            labelAr="fieldSubtitleAr"
            valueFr={data.subtitle_fr}
            valueAr={data.subtitle_ar}
            onFr={(subtitle_fr) => set({ subtitle_fr })}
            onAr={(subtitle_ar) => set({ subtitle_ar })}
          />
          <ImageUploader
            label={t("fieldImage")}
            prefix="landing/"
            value={data.image_url}
            onChange={(image_url) => set({ image_url })}
          />
          <Pair
            labelFr="fieldCtaLabelFr"
            labelAr="fieldCtaLabelAr"
            valueFr={data.cta_label_fr}
            valueAr={data.cta_label_ar}
            onFr={(cta_label_fr) => set({ cta_label_fr })}
            onAr={(cta_label_ar) => set({ cta_label_ar })}
          />
          <CtaTargetField value={data.cta_target} onChange={(cta_target) => set({ cta_target })} />
        </div>
      );
    }

    case "bullets": {
      const data = block.data;
      const set = (patch: Partial<typeof data>) =>
        onChange({ ...block, data: { ...data, ...patch } });
      return (
        <div className="space-y-4">
          <Pair
            labelFr="fieldTitleFr"
            labelAr="fieldTitleAr"
            valueFr={data.title_fr}
            valueAr={data.title_ar}
            onFr={(title_fr) => set({ title_fr })}
            onAr={(title_ar) => set({ title_ar })}
          />
          <ItemList
            items={data.items}
            onChange={(items) => set({ items })}
            create={() => ({ text_fr: "", text_ar: "" })}
            render={(item, update) => (
              <Pair
                labelFr="fieldBodyFr"
                labelAr="fieldBodyAr"
                valueFr={item.text_fr}
                valueAr={item.text_ar}
                onFr={(text_fr) => update({ text_fr })}
                onAr={(text_ar) => update({ text_ar })}
              />
            )}
          />
        </div>
      );
    }

    case "features": {
      const data = block.data;
      const set = (patch: Partial<typeof data>) =>
        onChange({ ...block, data: { ...data, ...patch } });
      return (
        <div className="space-y-4">
          <Pair
            labelFr="fieldTitleFr"
            labelAr="fieldTitleAr"
            valueFr={data.title_fr}
            valueAr={data.title_ar}
            onFr={(title_fr) => set({ title_fr })}
            onAr={(title_ar) => set({ title_ar })}
          />
          <ItemList
            items={data.items}
            onChange={(items) => set({ items })}
            create={() => ({
              icon: "ShieldCheck",
              title_fr: "",
              title_ar: "",
              text_fr: "",
              text_ar: "",
            })}
            render={(item, update) => (
              <div className="space-y-3">
                <IconField value={item.icon} onChange={(icon) => update({ icon })} />
                <Pair
                  labelFr="fieldTitleFr"
                  labelAr="fieldTitleAr"
                  valueFr={item.title_fr}
                  valueAr={item.title_ar}
                  onFr={(title_fr) => update({ title_fr })}
                  onAr={(title_ar) => update({ title_ar })}
                />
                <Pair
                  multiline
                  labelFr="fieldBodyFr"
                  labelAr="fieldBodyAr"
                  valueFr={item.text_fr}
                  valueAr={item.text_ar}
                  onFr={(text_fr) => update({ text_fr })}
                  onAr={(text_ar) => update({ text_ar })}
                />
              </div>
            )}
          />
        </div>
      );
    }

    case "gallery": {
      const data = block.data;
      const set = (patch: Partial<typeof data>) =>
        onChange({ ...block, data: { ...data, ...patch } });
      return (
        <div className="space-y-4">
          <Pair
            labelFr="fieldTitleFr"
            labelAr="fieldTitleAr"
            valueFr={data.title_fr}
            valueAr={data.title_ar}
            onFr={(title_fr) => set({ title_fr })}
            onAr={(title_ar) => set({ title_ar })}
          />
          <MultiImageUploader
            urls={data.images.map((image) => image.url)}
            onChange={(urls) => set({ images: urls.map((url) => ({ url, alt: "" })) })}
            prefix="landing/"
          />
        </div>
      );
    }

    case "video": {
      const data = block.data;
      const set = (patch: Partial<typeof data>) =>
        onChange({ ...block, data: { ...data, ...patch } });
      return (
        <div className="space-y-4">
          <Pair
            labelFr="fieldTitleFr"
            labelAr="fieldTitleAr"
            valueFr={data.title_fr}
            valueAr={data.title_ar}
            onFr={(title_fr) => set({ title_fr })}
            onAr={(title_ar) => set({ title_ar })}
          />
          <Field label={t("fieldVideoUrl")}>
            <Input
              dir="ltr"
              value={data.url}
              onChange={(event) => set({ url: event.target.value })}
            />
          </Field>
          <ImageUploader
            label={t("fieldPoster")}
            prefix="landing/"
            value={data.poster_url}
            onChange={(poster_url) => set({ poster_url })}
          />
        </div>
      );
    }

    case "text": {
      const data = block.data;
      const set = (patch: Partial<typeof data>) =>
        onChange({ ...block, data: { ...data, ...patch } });
      return (
        <div className="space-y-4">
          <Pair
            labelFr="fieldTitleFr"
            labelAr="fieldTitleAr"
            valueFr={data.title_fr}
            valueAr={data.title_ar}
            onFr={(title_fr) => set({ title_fr })}
            onAr={(title_ar) => set({ title_ar })}
          />
          <Pair
            multiline
            labelFr="fieldBodyFr"
            labelAr="fieldBodyAr"
            valueFr={data.body_fr}
            valueAr={data.body_ar}
            onFr={(body_fr) => set({ body_fr })}
            onAr={(body_ar) => set({ body_ar })}
          />
          <Field label={t("fieldAlign")}>
            <Select
              value={data.align}
              onChange={(event) => set({ align: event.target.value as "start" | "center" })}
            >
              <option value="start">{t("fieldAlignStart")}</option>
              <option value="center">{t("fieldAlignCenter")}</option>
            </Select>
          </Field>
        </div>
      );
    }

    case "offer": {
      const data = block.data;
      const set = (patch: Partial<typeof data>) =>
        onChange({ ...block, data: { ...data, ...patch } });
      return (
        <div className="space-y-4">
          <Pair
            labelFr="fieldTitleFr"
            labelAr="fieldTitleAr"
            valueFr={data.title_fr}
            valueAr={data.title_ar}
            onFr={(title_fr) => set({ title_fr })}
            onAr={(title_ar) => set({ title_ar })}
          />
          <Pair
            labelFr="fieldNoteFr"
            labelAr="fieldNoteAr"
            valueFr={data.note_fr}
            valueAr={data.note_ar}
            onFr={(note_fr) => set({ note_fr })}
            onAr={(note_ar) => set({ note_ar })}
          />
          <Checkbox
            id={`offer-compare-${block.id}`}
            label={t("fieldShowCompareAt")}
            checked={data.show_compare_at}
            onChange={(event) => set({ show_compare_at: event.target.checked })}
          />
          <Pair
            labelFr="fieldCtaLabelFr"
            labelAr="fieldCtaLabelAr"
            valueFr={data.cta_label_fr}
            valueAr={data.cta_label_ar}
            onFr={(cta_label_fr) => set({ cta_label_fr })}
            onAr={(cta_label_ar) => set({ cta_label_ar })}
          />
          <CtaTargetField value={data.cta_target} onChange={(cta_target) => set({ cta_target })} />
        </div>
      );
    }

    case "reviews": {
      const data = block.data;
      const set = (patch: Partial<typeof data>) =>
        onChange({ ...block, data: { ...data, ...patch } });
      return (
        <div className="space-y-4">
          <Pair
            labelFr="fieldTitleFr"
            labelAr="fieldTitleAr"
            valueFr={data.title_fr}
            valueAr={data.title_ar}
            onFr={(title_fr) => set({ title_fr })}
            onAr={(title_ar) => set({ title_ar })}
          />
          <Field label={t("fieldReviewSource")}>
            <Select
              value={data.source}
              onChange={(event) => set({ source: event.target.value as "store" | "custom" })}
            >
              <option value="store">{t("fieldReviewSourceStore")}</option>
              <option value="custom">{t("fieldReviewSourceCustom")}</option>
            </Select>
          </Field>

          {data.source === "custom" && (
            <ItemList
              items={data.items}
              onChange={(items) => set({ items })}
              create={() => ({
                name: "",
                stars: 5,
                text_fr: "",
                text_ar: "",
                image_url: null,
              })}
              render={(item, update) => (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("fieldName")}>
                      <Input
                        value={item.name}
                        onChange={(event) => update({ name: event.target.value })}
                      />
                    </Field>
                    <Field label={t("fieldStars")}>
                      <Select
                        value={item.stars}
                        onChange={(event) => update({ stars: Number(event.target.value) })}
                      >
                        {[5, 4, 3, 2, 1].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <Pair
                    multiline
                    labelFr="fieldBodyFr"
                    labelAr="fieldBodyAr"
                    valueFr={item.text_fr}
                    valueAr={item.text_ar}
                    onFr={(text_fr) => update({ text_fr })}
                    onAr={(text_ar) => update({ text_ar })}
                  />
                  <ImageUploader
                    compact
                    label={t("fieldImage")}
                    prefix="landing/"
                    value={item.image_url}
                    onChange={(image_url) => update({ image_url })}
                  />
                </div>
              )}
            />
          )}
        </div>
      );
    }

    case "faq": {
      const data = block.data;
      const set = (patch: Partial<typeof data>) =>
        onChange({ ...block, data: { ...data, ...patch } });
      return (
        <div className="space-y-4">
          <Pair
            labelFr="fieldTitleFr"
            labelAr="fieldTitleAr"
            valueFr={data.title_fr}
            valueAr={data.title_ar}
            onFr={(title_fr) => set({ title_fr })}
            onAr={(title_ar) => set({ title_ar })}
          />
          <ItemList
            items={data.items}
            onChange={(items) => set({ items })}
            create={() => ({ q_fr: "", q_ar: "", a_fr: "", a_ar: "" })}
            render={(item, update) => (
              <div className="space-y-3">
                <Pair
                  labelFr="fieldQuestionFr"
                  labelAr="fieldQuestionAr"
                  valueFr={item.q_fr}
                  valueAr={item.q_ar}
                  onFr={(q_fr) => update({ q_fr })}
                  onAr={(q_ar) => update({ q_ar })}
                />
                <Pair
                  multiline
                  labelFr="fieldAnswerFr"
                  labelAr="fieldAnswerAr"
                  valueFr={item.a_fr}
                  valueAr={item.a_ar}
                  onFr={(a_fr) => update({ a_fr })}
                  onAr={(a_ar) => update({ a_ar })}
                />
              </div>
            )}
          />
        </div>
      );
    }

    case "countdown": {
      const data = block.data;
      const set = (patch: Partial<typeof data>) =>
        onChange({ ...block, data: { ...data, ...patch } });
      return (
        <div className="space-y-4">
          <Pair
            labelFr="fieldTitleFr"
            labelAr="fieldTitleAr"
            valueFr={data.title_fr}
            valueAr={data.title_ar}
            onFr={(title_fr) => set({ title_fr })}
            onAr={(title_ar) => set({ title_ar })}
          />
          <Field label={t("fieldEndsAt")}>
            <Input
              type="datetime-local"
              dir="ltr"
              value={data.ends_at ? data.ends_at.slice(0, 16) : ""}
              onChange={(event) =>
                set({
                  ends_at: event.target.value
                    ? new Date(event.target.value).toISOString()
                    : null,
                })
              }
            />
          </Field>
          <Pair
            labelFr="fieldNoteFr"
            labelAr="fieldNoteAr"
            valueFr={data.note_fr}
            valueAr={data.note_ar}
            onFr={(note_fr) => set({ note_fr })}
            onAr={(note_ar) => set({ note_ar })}
          />
        </div>
      );
    }

    case "trust": {
      const data = block.data;
      const set = (patch: Partial<typeof data>) =>
        onChange({ ...block, data: { ...data, ...patch } });
      return (
        <ItemList
          items={data.items}
          onChange={(items) => set({ items })}
          create={() => ({ icon: "ShieldCheck", label_fr: "", label_ar: "" })}
          render={(item, update) => (
            <div className="space-y-3">
              <IconField value={item.icon} onChange={(icon) => update({ icon })} />
              <Pair
                labelFr="fieldLabelFr"
                labelAr="fieldLabelAr"
                valueFr={item.label_fr}
                valueAr={item.label_ar}
                onFr={(label_fr) => update({ label_fr })}
                onAr={(label_ar) => update({ label_ar })}
              />
            </div>
          )}
        />
      );
    }

    case "order_form": {
      const data = block.data;
      const set = (patch: Partial<typeof data>) =>
        onChange({ ...block, data: { ...data, ...patch } });
      return (
        <div className="space-y-4">
          <Pair
            labelFr="fieldTitleFr"
            labelAr="fieldTitleAr"
            valueFr={data.title_fr}
            valueAr={data.title_ar}
            onFr={(title_fr) => set({ title_fr })}
            onAr={(title_ar) => set({ title_ar })}
          />
          <Pair
            labelFr="fieldNoteFr"
            labelAr="fieldNoteAr"
            valueFr={data.note_fr}
            valueAr={data.note_ar}
            onFr={(note_fr) => set({ note_fr })}
            onAr={(note_ar) => set({ note_ar })}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Checkbox
              id={`of-addr-${block.id}`}
              label={t("fieldAskAddress")}
              checked={data.ask_address}
              onChange={(event) => set({ ask_address: event.target.checked })}
            />
            <Checkbox
              id={`of-notes-${block.id}`}
              label={t("fieldAskNotes")}
              checked={data.ask_notes}
              onChange={(event) => set({ ask_notes: event.target.checked })}
            />
          </div>
        </div>
      );
    }

    case "cta": {
      const data = block.data;
      const set = (patch: Partial<typeof data>) =>
        onChange({ ...block, data: { ...data, ...patch } });
      return (
        <div className="space-y-4">
          <Pair
            labelFr="fieldTitleFr"
            labelAr="fieldTitleAr"
            valueFr={data.title_fr}
            valueAr={data.title_ar}
            onFr={(title_fr) => set({ title_fr })}
            onAr={(title_ar) => set({ title_ar })}
          />
          <Pair
            labelFr="fieldSubtitleFr"
            labelAr="fieldSubtitleAr"
            valueFr={data.subtitle_fr}
            valueAr={data.subtitle_ar}
            onFr={(subtitle_fr) => set({ subtitle_fr })}
            onAr={(subtitle_ar) => set({ subtitle_ar })}
          />
          <Pair
            labelFr="fieldLabelFr"
            labelAr="fieldLabelAr"
            valueFr={data.label_fr}
            valueAr={data.label_ar}
            onFr={(label_fr) => set({ label_fr })}
            onAr={(label_ar) => set({ label_ar })}
          />
          <CtaTargetField value={data.target} onChange={(target) => set({ target })} />
        </div>
      );
    }

    case "spacer": {
      const data = block.data;
      return (
        <Field label={t("fieldSize")}>
          <Select
            value={data.size}
            onChange={(event) =>
              onChange({
                ...block,
                data: { size: event.target.value as "sm" | "md" | "lg" },
              })
            }
          >
            <option value="sm">{t("fieldSizeSm")}</option>
            <option value="md">{t("fieldSizeMd")}</option>
            <option value="lg">{t("fieldSizeLg")}</option>
          </Select>
        </Field>
      );
    }

    default:
      return null;
  }
}
