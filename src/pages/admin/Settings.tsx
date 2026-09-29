import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ImagePlus, Save, Trash2 } from "lucide-react";
import { AdminPage, Panel } from "@/components/admin/AdminPage";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/Form";
import { ErrorState, LoadingBlock, Spinner } from "@/components/ui/Feedback";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { supabase } from "@/lib/supabase";
import type { HeroSlide, StoreSettings } from "@/types/db";

/**
 * Editable columns only — never spread the loaded row into the update.
 *
 * `shipping_fee` is excluded on purpose: nothing prices from it. Delivery is
 * charged per wilaya (delivery_prices) by place_order(), so an editable
 * "default fee" here only invited the owner to change a number with no effect.
 */
type SettingsFormState = Omit<StoreSettings, "id" | "updated_at" | "shipping_fee">;

function toFormState(row: StoreSettings): SettingsFormState {
  return {
    free_ship_threshold:
      row.free_ship_threshold === null ? null : Number(row.free_ship_threshold),
    store_phone: row.store_phone,
    store_email: row.store_email,
    facebook_url: row.facebook_url,
    instagram_url: row.instagram_url,
    tiktok_url: row.tiktok_url,
    announcement_fr: row.announcement_fr,
    announcement_ar: row.announcement_ar,
    announcement_active: row.announcement_active,
    hero_slides: Array.isArray(row.hero_slides) ? row.hero_slides : [],
    marquee_main_fr: row.marquee_main_fr ?? null,
    marquee_main_ar: row.marquee_main_ar ?? null,
    marquee_sub_fr: row.marquee_sub_fr ?? null,
    marquee_sub_ar: row.marquee_sub_ar ?? null,
  };
}

function blankSlide(): HeroSlide {
  return {
    id: crypto.randomUUID(),
    image_url: "",
    title_fr: null,
    title_ar: null,
    subtitle_fr: null,
    subtitle_ar: null,
    link_url: null,
  };
}

export default function AdminSettings() {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useStoreSettings();

  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(toFormState(data));
  }, [data]);

  const patch = (values: Partial<SettingsFormState>) =>
    setForm((current) => (current ? { ...current, ...values } : current));

  const patchSlide = (id: string, values: Partial<HeroSlide>) =>
    patch({
      hero_slides: (form?.hero_slides ?? []).map((slide) =>
        slide.id === id ? { ...slide, ...values } : slide,
      ),
    });

  const moveSlide = (index: number, to: number) => {
    const slides = [...(form?.hero_slides ?? [])];
    if (to < 0 || to >= slides.length) return;
    const [moved] = slides.splice(index, 1);
    slides.splice(to, 0, moved);
    patch({ hero_slides: slides });
  };

  const onSave = async () => {
    if (!form) return;

    // An imageless slide would render as a blank panel in the hero rotation.
    if (form.hero_slides.some((slide) => !slide.image_url)) {
      toast.error(t("setHeroImageRequired"));
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("store_settings").update(form).eq("id", 1);
    setSaving(false);

    if (error) {
      toast.error(t("adminSaveError"));
      return;
    }
    toast.success(t("adminSaved"));
    queryClient.invalidateQueries({ queryKey: ["store-settings"] });
  };

  if (isLoading) return <LoadingBlock label={t("loading")} />;

  // A failed load must block the form, not fall through to blank defaults that
  // the next Save would write over the real settings.
  if (isError || !form) {
    return (
      <AdminPage title={t("setTitle")}>
        <ErrorState title={t("adminLoadError")} />
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title={t("setTitle")}
      action={
        <Button size="sm" onClick={() => void onSave()} disabled={saving}>
          {saving ? <Spinner /> : <Save size={15} />}
          {saving ? t("saving") : t("save")}
        </Button>
      }
    >
      <div className="space-y-6">
        <Panel title={t("shipping")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("setFreeShip")}
              hint={
                form.free_ship_threshold === null ? t("setFreeShipOff") : t("setFreeShipHint")
              }
            >
              <Input
                type="number"
                min={0}
                dir="ltr"
                placeholder={t("setFreeShipOff")}
                value={form.free_ship_threshold ?? ""}
                onChange={(event) =>
                  patch({
                    // Empty means the offer is OFF — not "everything free".
                    free_ship_threshold:
                      event.target.value === "" ? null : Number(event.target.value),
                  })
                }
              />
            </Field>
          </div>
        </Panel>

        <Panel title={t("setContact")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("setPhone")}>
              <Input
                dir="ltr"
                value={form.store_phone ?? ""}
                onChange={(event) => patch({ store_phone: event.target.value || null })}
              />
            </Field>
            <Field label={t("setEmail")}>
              <Input
                dir="ltr"
                type="email"
                value={form.store_email ?? ""}
                onChange={(event) => patch({ store_email: event.target.value || null })}
              />
            </Field>
          </div>
        </Panel>

        <Panel title={t("setSocial")}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("setFacebook")}>
              <Input
                dir="ltr"
                value={form.facebook_url ?? ""}
                onChange={(event) => patch({ facebook_url: event.target.value || null })}
              />
            </Field>
            <Field label={t("setInstagram")}>
              <Input
                dir="ltr"
                value={form.instagram_url ?? ""}
                onChange={(event) => patch({ instagram_url: event.target.value || null })}
              />
            </Field>
            <Field label={t("setTiktok")}>
              <Input
                dir="ltr"
                value={form.tiktok_url ?? ""}
                onChange={(event) => patch({ tiktok_url: event.target.value || null })}
              />
            </Field>
          </div>
        </Panel>

        <Panel title={t("setAnnouncement")}>
          <div className="space-y-4">
            <Checkbox
              id="set-announce"
              label={t("setAnnouncementActive")}
              checked={form.announcement_active}
              onChange={(event) => patch({ announcement_active: event.target.checked })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("setAnnouncementFr")}>
                <Textarea
                  rows={2}
                  value={form.announcement_fr ?? ""}
                  onChange={(event) => patch({ announcement_fr: event.target.value || null })}
                />
              </Field>
              <Field label={t("setAnnouncementAr")}>
                <Textarea
                  rows={2}
                  dir="rtl"
                  value={form.announcement_ar ?? ""}
                  onChange={(event) => patch({ announcement_ar: event.target.value || null })}
                />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel title={t("setHero")}>
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-muted">{t("setHeroHint")}</p>

            {form.hero_slides.length === 0 && (
              <p className="border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                {t("setHeroEmpty")}
              </p>
            )}

            {form.hero_slides.map((slide, index) => (
              <div key={slide.id} className="border border-line bg-panel-2 p-4">
                <div className="flex items-start gap-4">
                  <ImageUploader
                    value={slide.image_url || null}
                    onChange={(url) => patchSlide(slide.id, { image_url: url ?? "" })}
                    prefix="hero"
                  />

                  <div className="flex-1 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={t("setHeroTitleFr")}>
                        <Input
                          value={slide.title_fr ?? ""}
                          onChange={(event) =>
                            patchSlide(slide.id, { title_fr: event.target.value || null })
                          }
                        />
                      </Field>
                      <Field label={t("setHeroTitleAr")}>
                        <Input
                          dir="rtl"
                          value={slide.title_ar ?? ""}
                          onChange={(event) =>
                            patchSlide(slide.id, { title_ar: event.target.value || null })
                          }
                        />
                      </Field>
                      <Field label={t("setHeroSubtitleFr")}>
                        <Input
                          value={slide.subtitle_fr ?? ""}
                          onChange={(event) =>
                            patchSlide(slide.id, { subtitle_fr: event.target.value || null })
                          }
                        />
                      </Field>
                      <Field label={t("setHeroSubtitleAr")}>
                        <Input
                          dir="rtl"
                          value={slide.subtitle_ar ?? ""}
                          onChange={(event) =>
                            patchSlide(slide.id, { subtitle_ar: event.target.value || null })
                          }
                        />
                      </Field>
                    </div>
                    <Field label={t("setHeroLink")} hint={t("setHeroLinkHint")}>
                      <Input
                        dir="ltr"
                        value={slide.link_url ?? ""}
                        onChange={(event) =>
                          patchSlide(slide.id, { link_url: event.target.value || null })
                        }
                      />
                    </Field>
                  </div>

                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveSlide(index, index - 1)}
                      disabled={index === 0}
                      aria-label={t("lpMoveUp")}
                      className="border border-line p-1.5 text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-40"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSlide(index, index + 1)}
                      disabled={index === form.hero_slides.length - 1}
                      aria-label={t("lpMoveDown")}
                      className="border border-line p-1.5 text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-40"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          hero_slides: form.hero_slides.filter(
                            (entry) => entry.id !== slide.id,
                          ),
                        })
                      }
                      aria-label={t("delete")}
                      className="border border-line p-1.5 text-muted transition-colors hover:border-danger hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={() => patch({ hero_slides: [...form.hero_slides, blankSlide()] })}
            >
              <ImagePlus size={14} />
              {t("setHeroAdd")}
            </Button>
          </div>
        </Panel>

        <Panel title={t("setMarquee")}>
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-muted">{t("setMarqueeHint")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("setMarqueeMainFr")}>
                <Input
                  placeholder={t("marqueeMain")}
                  value={form.marquee_main_fr ?? ""}
                  onChange={(event) =>
                    patch({ marquee_main_fr: event.target.value || null })
                  }
                />
              </Field>
              <Field label={t("setMarqueeMainAr")}>
                <Input
                  dir="rtl"
                  placeholder={t("marqueeMain")}
                  value={form.marquee_main_ar ?? ""}
                  onChange={(event) =>
                    patch({ marquee_main_ar: event.target.value || null })
                  }
                />
              </Field>
              <Field label={t("setMarqueeSubFr")}>
                <Input
                  placeholder={t("marqueeSub")}
                  value={form.marquee_sub_fr ?? ""}
                  onChange={(event) =>
                    patch({ marquee_sub_fr: event.target.value || null })
                  }
                />
              </Field>
              <Field label={t("setMarqueeSubAr")}>
                <Input
                  dir="rtl"
                  placeholder={t("marqueeSub")}
                  value={form.marquee_sub_ar ?? ""}
                  onChange={(event) =>
                    patch({ marquee_sub_ar: event.target.value || null })
                  }
                />
              </Field>
            </div>
          </div>
        </Panel>
      </div>
    </AdminPage>
  );
}
